-- migration_029_performance_cleanup.sql
-- UNAPPLIED. Do not apply until reviewed.
-- Depends on 026 (regrade_log) and on the live policies from 001, 007, 008,
-- 009, and 015. Does not edit 004, 025, or 028. Does not re-apply them.
--
-- HIGH RISK
-- * Adds indexes. Drops and recreates policies on questions, exams, and
--   profiles only. No other table's policies are changed.
-- * Does not grant anything to anon. Does not change function grants.
-- * Does not touch proxy.ts, .env, or auth.
-- * No DELETE of rows.
--
-- Not applied.
--
-- BEFORE policies (expected from rls_setup.sql, the 2026-09-08 role note,
-- and migrations 007, 008, 009, and 015). Live names can differ. This file
-- reads pg_policy and refuses to finish if a duplicate permissive pair
-- remains. The apply log prints the live before and after lists.
--
-- questions
--   "Allow public read on questions"  SELECT  public         USING (true)
--   questions_select_staff            SELECT  authenticated  USING (is_staff())
--   questions_insert_staff            INSERT  authenticated  WITH CHECK (is_staff())
--   questions_update_staff            UPDATE  authenticated  USING (is_staff())
--   questions_delete_admin            DELETE  authenticated  USING (is_admin())
-- exams
--   exams_select_staff                SELECT  authenticated  USING (is_staff())
--   exams_insert_admin                INSERT  authenticated  WITH CHECK (is_admin())
--   exams_insert_staff                INSERT  authenticated  WITH CHECK (is_staff())
--   exams_update_admin                UPDATE  authenticated  USING (is_admin())
--   exams_update_staff_override       UPDATE  authenticated  USING (is_staff())
--   exams_delete_admin                DELETE  authenticated  USING (is_admin())
--   "Allow public read on exams" was dropped by migration 009.
-- profiles
--   profiles_select_own               SELECT  authenticated  USING (auth.uid() = id)
--   profiles_select_admin             SELECT  authenticated  USING (is_admin())
--
-- AFTER policies
-- questions
--   "Allow public read on questions"  SELECT  public         USING (true)
--   questions_insert_staff            INSERT  authenticated  WITH CHECK (is_staff())
--   questions_update_staff            UPDATE  authenticated  USING (is_staff())
--   questions_delete_admin            DELETE  authenticated  USING (is_admin())
--   questions_select_staff is removed when the public read is USING (true).
--   That read already allows the staff select, so the second policy only
--   costs a second check.
-- exams
--   exams_select_staff                SELECT  authenticated  USING (is_staff())
--   exams_insert_merged               INSERT  authenticated
--     WITH CHECK ((is_admin()) or (is_staff()))
--   exams_update_merged               UPDATE  authenticated
--     USING ((is_admin()) or (is_staff()))
--     WITH CHECK ((is_admin()) or (is_staff()))
--   exams_delete_admin                DELETE  authenticated  USING (is_admin())
--   The merged check is the same set of rows the two permissive policies
--   allowed together. is_staff() already includes admin. The trigger
--   exams_restrict_staff_updates still blocks a teacher from editing any
--   column except active_timeslot_override.
-- profiles
--   profiles_select_merged            SELECT  authenticated
--     USING (((select auth.uid()) = id) or (is_admin()))
--   Own-row and admin-read are one policy. auth.uid() is wrapped so the
--   planner evaluates it once per statement.
--
-- Indexes added for foreign keys that are not a leading index prefix.
-- Already covered, so this file does not add another index:
--   timeslots.exam_id                         unique (exam_id, label)
--   exam_sections.exam_id                     unique (exam_id, position)
--   grades.student_id                         unique (student_id, exam_id)
--   section_timeslot_question_sets.exam_id    section_timeslot_question_sets_exam_id_idx
--   section_timeslot_question_sets.timeslot_id unique (timeslot_id, section_id)
--   timeslot_draws.timeslot_id                primary key (timeslot_id, question_id)
--   response_marks.response_id                primary key
--   responses.test_instance_id                when unique (test_instance_id, question_id) exists
-- Created when still unindexed:
--   test_instances_exam_id_idx
--   test_instances_student_id_idx
--   test_instances_timeslot_id_idx
--   responses_question_id_idx
--   responses_reviewed_by_idx
--   grades_exam_id_idx
--   exams_active_timeslot_override_idx
--   section_timeslot_question_sets_section_id_idx
--   timeslot_draws_question_id_idx
--   regrade_log_question_id_idx
-- Any other public foreign key the catalog still reports is indexed too.
-- Does not drop "Allow public read on test_instances". Migration 028 already did.

begin;

create or replace function pg_temp.wrap_uid(p_expr text)
returns text
language sql
immutable
as $$
  select case
    when p_expr is null then null
    else replace(
      replace(
        replace(p_expr, '(select auth.uid())', '___UID___'),
        'auth.uid()',
        '(select auth.uid())'
      ),
      '___UID___',
      '(select auth.uid())'
    )
  end
$$;

create or replace function pg_temp.norm_expr(p_expr text)
returns text
language plpgsql
immutable
as $$
declare
  v text := p_expr;
  i integer;
  depth integer;
begin
  if v is null then
    return null;
  end if;
  v := lower(v);
  v := regexp_replace(v, '\s+', '', 'g');
  v := replace(v, 'public.', '');
  while length(v) >= 2 and left(v, 1) = '(' and right(v, 1) = ')' loop
    depth := 0;
    for i in 1..length(v) loop
      if substring(v from i for 1) = '(' then
        depth := depth + 1;
      elsif substring(v from i for 1) = ')' then
        depth := depth - 1;
        if depth = 0 and i < length(v) then
          return v;
        end if;
      end if;
    end loop;
    v := substring(v from 2 for length(v) - 2);
  end loop;
  return v;
end;
$$;

do $$
declare
  r record;
  v_rel text;
  v_cols text;
  v_idx text;
  v_covered boolean;
begin
  if to_regclass('public.regrade_log') is null then
    raise exception 'migration 029 expects public.regrade_log from migration 026';
  end if;

  for r in
    select
      c.relname,
      con.conname,
      con.conkey,
      con.conrelid,
      (
        select string_agg(quote_ident(a.attname), ', ' order by u.ord)
        from unnest(con.conkey) with ordinality as u(attnum, ord)
        join pg_attribute a
          on a.attrelid = con.conrelid
         and a.attnum = u.attnum
      ) as cols
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where con.contype = 'f'
      and n.nspname = 'public'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = con.conrelid
          and i.indisvalid
          and i.indpred is null
          and (
            select coalesce(bool_and(i.indkey[u.ord - 1] = u.attnum), false)
            from unnest(con.conkey) with ordinality as u(attnum, ord)
          )
      )
  loop
    v_rel := r.relname;
    v_cols := r.cols;
    v_idx := case
      when v_rel = 'test_instances' and v_cols = 'exam_id' then 'test_instances_exam_id_idx'
      when v_rel = 'test_instances' and v_cols = 'student_id' then 'test_instances_student_id_idx'
      when v_rel = 'test_instances' and v_cols = 'timeslot_id' then 'test_instances_timeslot_id_idx'
      when v_rel = 'responses' and v_cols = 'question_id' then 'responses_question_id_idx'
      when v_rel = 'responses' and v_cols = 'reviewed_by' then 'responses_reviewed_by_idx'
      when v_rel = 'grades' and v_cols = 'exam_id' then 'grades_exam_id_idx'
      when v_rel = 'exams' and v_cols = 'active_timeslot_override' then 'exams_active_timeslot_override_idx'
      when v_rel = 'section_timeslot_question_sets' and v_cols = 'section_id'
        then 'section_timeslot_question_sets_section_id_idx'
      when v_rel = 'timeslot_draws' and v_cols = 'question_id' then 'timeslot_draws_question_id_idx'
      when v_rel = 'regrade_log' and v_cols = 'question_id' then 'regrade_log_question_id_idx'
      else left(v_rel || '_' || replace(v_cols, ', ', '_') || '_fkey_idx', 63)
    end;

    select exists (
      select 1
      from pg_class ic
      join pg_namespace nn on nn.oid = ic.relnamespace
      where ic.relname = v_idx
        and nn.nspname = 'public'
    ) into v_covered;

    if v_covered then
      continue;
    end if;

    execute format('create index %I on public.%I (%s)', v_idx, v_rel, v_cols);
    raise notice 'created index % on %.%(%)', v_idx, 'public', v_rel, v_cols;
  end loop;
end;
$$;

do $$
declare
  r record;
  g record;
  v_before text;
  v_after text;
  v_using text;
  v_check text;
  v_sql text;
  v_dup text;
  v_name text;
  v_names text[];
begin
  select string_agg(
    format(
      '%s | %s | %s | %s | using %s | check %s',
      c.relname,
      pol.polname,
      case pol.polcmd
        when 'r' then 'select'
        when 'a' then 'insert'
        when 'w' then 'update'
        when 'd' then 'delete'
        else 'all'
      end,
      coalesce(
        (select string_agg(quote_ident(rr.rolname), ', ' order by rr.rolname)
         from pg_roles rr where rr.oid = any (pol.polroles)),
        'public'
      ),
      coalesce(pg_get_expr(pol.polqual, pol.polrelid), ''),
      coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
    ),
    E'\n' order by c.relname, pol.polname
  )
  into v_before
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('questions', 'exams', 'profiles');

  raise notice 'BEFORE policies% %', E'\n', coalesce(v_before, '(none)');

  for r in
    select
      c.relname,
      pol.polname,
      pol.polpermissive,
      case pol.polcmd
        when 'r' then 'select'
        when 'a' then 'insert'
        when 'w' then 'update'
        when 'd' then 'delete'
        else 'all'
      end as cmd,
      coalesce(
        (select string_agg(quote_ident(rr.rolname), ', ' order by rr.rolname)
         from pg_roles rr where rr.oid = any (pol.polroles)),
        'public'
      ) as roles,
      pg_get_expr(pol.polqual, pol.polrelid) as qual,
      pg_get_expr(pol.polwithcheck, pol.polrelid) as chk
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('questions', 'exams', 'profiles')
      and (
        coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%auth.uid()%'
        or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%auth.uid()%'
      )
  loop
    if pg_temp.wrap_uid(r.qual) is not distinct from r.qual
       and pg_temp.wrap_uid(r.chk) is not distinct from r.chk then
      continue;
    end if;

    execute format('drop policy %I on public.%I', r.polname, r.relname);
    v_sql := format(
      'create policy %I on public.%I as %s for %s to %s',
      r.polname,
      r.relname,
      case when r.polpermissive then 'permissive' else 'restrictive' end,
      r.cmd,
      r.roles
    );
    if r.qual is not null then
      v_sql := v_sql || format(' using (%s)', pg_temp.wrap_uid(r.qual));
    end if;
    if r.chk is not null then
      v_sql := v_sql || format(' with check (%s)', pg_temp.wrap_uid(r.chk));
    end if;
    execute v_sql;
  end loop;

  -- A public USING (true) policy already allows every role. Other permissive
  -- policies for that same command do not add rows. Drop them.
  select coalesce(array_agg(distinct format('%s.%s', ec.relname, extra.polname)), '{}')
  into v_names
  from pg_policy keeper
  join pg_class kc on kc.oid = keeper.polrelid
  join pg_namespace kn on kn.oid = kc.relnamespace
  join pg_policy extra on extra.polrelid = keeper.polrelid and extra.polcmd = keeper.polcmd
  join pg_class ec on ec.oid = extra.polrelid
  where kn.nspname = 'public'
    and kc.relname in ('questions', 'exams', 'profiles')
    and cardinality(keeper.polroles) = 0
    and keeper.polpermissive
    and extra.polpermissive
    and extra.oid <> keeper.oid
    and (
      (keeper.polcmd = 'r' and pg_temp.norm_expr(pg_get_expr(keeper.polqual, keeper.polrelid)) = 'true')
      or (keeper.polcmd = 'a' and pg_temp.norm_expr(pg_get_expr(keeper.polwithcheck, keeper.polrelid)) = 'true')
      or (keeper.polcmd = 'd' and pg_temp.norm_expr(pg_get_expr(keeper.polqual, keeper.polrelid)) = 'true')
      or (
        keeper.polcmd in ('w', '*')
        and pg_temp.norm_expr(pg_get_expr(keeper.polqual, keeper.polrelid)) = 'true'
        and pg_temp.norm_expr(coalesce(
          pg_get_expr(keeper.polwithcheck, keeper.polrelid),
          pg_get_expr(keeper.polqual, keeper.polrelid)
        )) = 'true'
      )
    );

  if v_names is not null then
    foreach v_name in array v_names loop
      execute format(
        'drop policy %I on public.%I',
        split_part(v_name, '.', 2),
        split_part(v_name, '.', 1)
      );
    end loop;
  end if;

  for g in
    select relname, polcmd, cmd, roles
    from (
      select
        c.relname,
        pol.polcmd,
        case pol.polcmd
          when 'r' then 'select'
          when 'a' then 'insert'
          when 'w' then 'update'
          when 'd' then 'delete'
          else 'all'
        end as cmd,
        coalesce(
          (select string_agg(quote_ident(rr.rolname), ', ' order by rr.rolname)
           from pg_roles rr where rr.oid = any (pol.polroles)),
          'public'
        ) as roles
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('questions', 'exams', 'profiles')
        and pol.polpermissive
    ) live
    group by relname, polcmd, cmd, roles
    having count(*) > 1
  loop
    select string_agg('(' || pg_get_expr(pol.polqual, pol.polrelid) || ')', ' or ' order by pol.polname)
    into v_using
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = g.relname
      and pol.polcmd = g.polcmd
      and pol.polpermissive
      and coalesce(
        (select string_agg(quote_ident(rr.rolname), ', ' order by rr.rolname)
         from pg_roles rr where rr.oid = any (pol.polroles)),
        'public'
      ) = g.roles
      and pg_get_expr(pol.polqual, pol.polrelid) is not null;

    select string_agg(
      '(' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), pg_get_expr(pol.polqual, pol.polrelid)) || ')',
      ' or ' order by pol.polname
    )
    into v_check
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = g.relname
      and pol.polcmd = g.polcmd
      and pol.polpermissive
      and coalesce(
        (select string_agg(quote_ident(rr.rolname), ', ' order by rr.rolname)
         from pg_roles rr where rr.oid = any (pol.polroles)),
        'public'
      ) = g.roles
      and coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), pg_get_expr(pol.polqual, pol.polrelid)) is not null;

    select coalesce(array_agg(pol.polname), '{}')
    into v_names
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = g.relname
      and pol.polcmd = g.polcmd
      and pol.polpermissive
      and coalesce(
        (select string_agg(quote_ident(rr.rolname), ', ' order by rr.rolname)
         from pg_roles rr where rr.oid = any (pol.polroles)),
        'public'
      ) = g.roles;

    foreach v_name in array v_names loop
      execute format('drop policy %I on public.%I', v_name, g.relname);
    end loop;

    v_sql := format(
      'create policy %I on public.%I as permissive for %s to %s',
      g.relname || '_' || g.cmd || '_merged',
      g.relname,
      g.cmd,
      g.roles
    );
    if g.cmd in ('select', 'delete', 'update', 'all') then
      v_sql := v_sql || format(' using (%s)', coalesce(v_using, 'true'));
    end if;
    if g.cmd in ('insert', 'update', 'all') then
      v_sql := v_sql || format(' with check (%s)', coalesce(v_check, 'true'));
    end if;
    execute v_sql;
  end loop;

  select string_agg(
    format('%s %s overlaps %s', c.relname, a.polname, b.polname),
    '; ' order by c.relname, a.polname, b.polname
  )
  into v_dup
  from pg_policy a
  join pg_policy b
    on b.polrelid = a.polrelid
   and b.polcmd = a.polcmd
   and b.oid > a.oid
   and a.polpermissive
   and b.polpermissive
   and (
     a.polroles && b.polroles
     or 0 = any(a.polroles)
     or 0 = any(b.polroles)
   )
  join pg_class c on c.oid = a.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('questions', 'exams', 'profiles');

  if v_dup is not null then
    raise exception 'duplicate permissive policies remain on questions, exams, or profiles: %', v_dup;
  end if;

  select string_agg(
    format(
      '%s | %s | %s | %s | using %s | check %s',
      c.relname,
      pol.polname,
      case pol.polcmd
        when 'r' then 'select'
        when 'a' then 'insert'
        when 'w' then 'update'
        when 'd' then 'delete'
        else 'all'
      end,
      coalesce(
        (select string_agg(quote_ident(rr.rolname), ', ' order by rr.rolname)
         from pg_roles rr where rr.oid = any (pol.polroles)),
        'public'
      ),
      coalesce(pg_get_expr(pol.polqual, pol.polrelid), ''),
      coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
    ),
    E'\n' order by c.relname, pol.polname
  )
  into v_after
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('questions', 'exams', 'profiles');

  raise notice 'AFTER policies% %', E'\n', coalesce(v_after, '(none)');
end;
$$;

commit;

-- Rollback (do not run as part of this file):
-- drop index if exists public.test_instances_exam_id_idx;
-- drop index if exists public.test_instances_student_id_idx;
-- drop index if exists public.test_instances_timeslot_id_idx;
-- drop index if exists public.responses_question_id_idx;
-- drop index if exists public.responses_reviewed_by_idx;
-- drop index if exists public.grades_exam_id_idx;
-- drop index if exists public.exams_active_timeslot_override_idx;
-- drop index if exists public.section_timeslot_question_sets_section_id_idx;
-- drop index if exists public.timeslot_draws_question_id_idx;
-- drop index if exists public.regrade_log_question_id_idx;
-- drop policy if exists questions_select_merged on public.questions;
-- drop policy if exists exams_insert_merged on public.exams;
-- drop policy if exists exams_update_merged on public.exams;
-- drop policy if exists profiles_select_merged on public.profiles;
-- Recreate any policy this file dropped, using the BEFORE policies list
-- above. Do not re-apply 004, 025, or 028.
