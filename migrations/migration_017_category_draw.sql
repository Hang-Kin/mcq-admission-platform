-- migration_017_category_draw.sql
-- Proposed. Do not apply until reviewed.
-- Depends on migration_016 (current start_session, resolve_exam_timeslot,
-- and section_timeslot_question_sets).
--
-- HIGH RISK
-- * Replaces start_session and submit_answer. Both stay SECURITY DEFINER.
--   Grants are unchanged: anon may execute them; public and authenticated
--   may not.
-- * New RLS on subject_settings and timeslot_draws only. Staff policies,
--   no anon policies, no grants to anon. No existing policy is changed.
-- * Does not touch proxy.ts, .env, or existing table policies.
--
-- What this file adds
-- * questions.subject ('Math' or 'Chinese', or null).
-- * exam_sections.subject, same values, nullable. Existing sections stay
--   null, so an exam with no subject still draws the old way.
-- * subject_settings. Seed: Math 2 questions / 7 minutes, Chinese 2 / 8.
--   The minute values are stored only. start_session still times a section
--   from exam_sections.duration_minutes.
-- * timeslot_draws, the frozen per-timeslot draw.
-- * draw_timeslot_questions: staff only, revoked from anon.
-- * Fraction answers: type 'fraction', canonical a/b check, and exact-match
--   grading in submit_answer.
--
-- Backfill (category is not rewritten)
-- * question_set = 'S1 Chinese Sample' -> subject 'Chinese'.
--   Category stays the topic.
-- * category in ('Math', 'math') -> subject 'Math'. Category stays as stored.
-- * category = 'Chinese' -> subject 'Chinese'. Category stays as stored.
-- * Chemistry, Geography, and every other category are left alone
--   (subject stays null). This file cannot list the live rows.
--
-- Draw rule
-- * Subjects come from exam_sections.subject on the timeslot's exam.
-- * For each subject, every distinct questions.category that is a real
--   topic is a draw bucket. A topic is a non-blank category whose trimmed
--   value is not math or chinese in any letter case. Those labels are the
--   legacy "no topic" rows. They are not drawn.
-- * A topic with no rows does not exist, so it cannot be reported as short.
--   A topic with too few rows fails the whole draw, for example
--   "Fractions: has 1, needs 2".
-- * The pool is subject + category across every question_set. question_set
--   does not limit the frozen draw.
-- * Idempotent. p_force replaces that timeslot's draw rows only when no
--   test_instances row for that timeslot has started_at set.
--   The only DELETE in this file is that replacement. It is not run when
--   the migration is applied.
--
-- start_session
-- * section_plan keys stay position, label, question_set, duration_minutes,
--   question_ids. question_set is still the section set or the timeslot
--   override. It is not rewritten when the ids come from a frozen draw.
-- * The only behavior change is how those question_ids are chosen.
--   If timeslot_draws has rows for the resolved timeslot and this section's
--   subject, use them, ordered by category then position then question id.
--   Otherwise the existing full question_set draw is unchanged, including
--   flat exams and the 'General' fallback.
--
-- The type-check change drops and recreates the questions type constraint
-- so 'fraction' is allowed. No rows are deleted.

-- ---------------------------------------------------------------------------
-- questions.subject
-- ---------------------------------------------------------------------------

alter table public.questions
  add column subject text;

update public.questions
set subject = 'Chinese'
where subject is null
  and question_set = 'S1 Chinese Sample';

update public.questions
set subject = case lower(category)
  when 'math' then 'Math'
  when 'chinese' then 'Chinese'
end
where subject is null
  and category in ('Math', 'math', 'Chinese');

alter table public.questions
  add constraint questions_subject_check
  check (subject is null or subject in ('Math', 'Chinese'));

-- Widen the type check. Name is discovered so this does not depend on the
-- generated constraint name. This DROP is the constraint only.
do $$
declare
  v_name text;
begin
  select con.conname
  into v_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'questions'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%''radio''%'
    and pg_get_constraintdef(con.oid) ilike '%''numeric''%'
    and pg_get_constraintdef(con.oid) ilike '%''text''%'
    and pg_get_constraintdef(con.oid) not ilike '%''fraction''%';

  if v_name is null then
    raise exception 'questions type check not found';
  end if;

  execute format(
    'alter table public.questions drop constraint %I',
    v_name
  );
end
$$;

alter table public.questions
  add constraint questions_type_check
  check (type in ('radio', 'numeric', 'text', 'fraction'));

-- Canonical fraction: optional minus, no leading zeros, denominator > 0,
-- lowest terms. 2/6 is rejected. 2/1 is allowed. -0/1 is rejected.
create or replace function public.fraction_answer_is_canonical(p_answer text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_slash integer;
  v_num text;
  v_den text;
  v_a integer;
  v_b integer;
  v_x integer;
  v_y integer;
  v_r integer;
begin
  if p_answer is null
     or p_answer !~ '^-?(0|[1-9][0-9]*)/[1-9][0-9]*$'
     or p_answer ~ '^-0/' then
    return false;
  end if;

  v_slash := strpos(p_answer, '/');
  v_num := substr(p_answer, 1, v_slash - 1);
  v_den := substr(p_answer, v_slash + 1);
  v_a := v_num::integer;
  v_b := v_den::integer;

  if v_b <= 0 then
    return false;
  end if;

  v_x := abs(v_a);
  v_y := v_b;
  while v_y <> 0 loop
    v_r := v_x % v_y;
    v_x := v_y;
    v_y := v_r;
  end loop;

  return v_x = 1;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.fraction_answer_is_canonical(text) from public;
revoke all on function public.fraction_answer_is_canonical(text) from anon;
grant execute on function public.fraction_answer_is_canonical(text) to authenticated;
grant execute on function public.fraction_answer_is_canonical(text) to current_user;

alter table public.questions
  add constraint questions_fraction_answer_check
  check (
    type <> 'fraction'
    or public.fraction_answer_is_canonical(correct_answer)
  );

-- ---------------------------------------------------------------------------
-- exam_sections.subject
-- Existing rows stay null and keep today's draw.
-- ---------------------------------------------------------------------------

alter table public.exam_sections
  add column subject text;

alter table public.exam_sections
  add constraint exam_sections_subject_check
  check (subject is null or subject in ('Math', 'Chinese'));

-- ---------------------------------------------------------------------------
-- subject_settings
-- HIGH RISK: new table RLS. Staff only. No anon.
-- ---------------------------------------------------------------------------

create table public.subject_settings (
  subject text primary key check (subject in ('Math', 'Chinese')),
  questions_per_category integer not null default 2 check (questions_per_category > 0),
  duration_minutes integer not null check (duration_minutes > 0)
);

alter table public.subject_settings enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subject_settings'
  loop
    execute format(
      'drop policy if exists %I on public.subject_settings',
      r.policyname
    );
  end loop;
end
$$;

create policy "subject_settings_select_staff"
  on public.subject_settings
  for select to authenticated using (is_staff());
create policy "subject_settings_insert_staff"
  on public.subject_settings
  for insert to authenticated with check (is_staff());
create policy "subject_settings_update_staff"
  on public.subject_settings
  for update to authenticated using (is_staff());
create policy "subject_settings_delete_admin"
  on public.subject_settings
  for delete to authenticated using (is_admin());

revoke all on table public.subject_settings from public;
revoke all on table public.subject_settings from anon;
grant select, insert, update, delete
  on table public.subject_settings to authenticated;

insert into public.subject_settings (subject, questions_per_category, duration_minutes)
values
  ('Math', 2, 7),
  ('Chinese', 2, 8);

-- ---------------------------------------------------------------------------
-- timeslot_draws
-- One frozen question per timeslot. position is 1..N inside a category.
-- HIGH RISK: new table RLS. Staff only. No anon.
-- Deleting a timeslot removes its draw rows (on delete cascade).
-- Deleting a question that is still drawn is refused (default restrict).
-- ---------------------------------------------------------------------------

create table public.timeslot_draws (
  timeslot_id uuid not null references public.timeslots(id) on delete cascade,
  subject text not null check (subject in ('Math', 'Chinese')),
  question_id uuid not null references public.questions(id),
  position integer not null check (position > 0),
  drawn_at timestamptz not null default now(),
  primary key (timeslot_id, question_id)
);

create index timeslot_draws_timeslot_subject_idx
  on public.timeslot_draws (timeslot_id, subject, position);

alter table public.timeslot_draws enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'timeslot_draws'
  loop
    execute format(
      'drop policy if exists %I on public.timeslot_draws',
      r.policyname
    );
  end loop;
end
$$;

create policy "timeslot_draws_select_staff"
  on public.timeslot_draws
  for select to authenticated using (is_staff());
create policy "timeslot_draws_insert_staff"
  on public.timeslot_draws
  for insert to authenticated with check (is_staff());
create policy "timeslot_draws_update_staff"
  on public.timeslot_draws
  for update to authenticated using (is_staff());
create policy "timeslot_draws_delete_admin"
  on public.timeslot_draws
  for delete to authenticated using (is_admin());

revoke all on table public.timeslot_draws from public;
revoke all on table public.timeslot_draws from anon;
grant select, insert, update, delete
  on table public.timeslot_draws to authenticated;

-- Legacy subject words are not topics. Blank is not a topic.
create or replace function public.question_category_is_topic(p_category text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(btrim(p_category), '') <> ''
    and lower(btrim(p_category)) not in ('math', 'chinese');
$$;

revoke all on function public.question_category_is_topic(text) from public;
revoke all on function public.question_category_is_topic(text) from anon;
revoke all on function public.question_category_is_topic(text) from authenticated;
grant execute on function public.question_category_is_topic(text) to current_user;

-- ---------------------------------------------------------------------------
-- draw_timeslot_questions
-- Staff check inside. EXECUTE revoked from anon and public.
-- ---------------------------------------------------------------------------

create or replace function public.draw_timeslot_questions(
  p_timeslot_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
  v_subject text;
  v_need integer;
  v_topic record;
  v_question_id uuid;
  v_position integer;
  v_subjects text[];
  v_errors text := '';
  v_expected integer := 0;
  v_inserted integer := 0;
  v_existing boolean;
  v_started boolean;
begin
  if coalesce(public.is_staff(), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_staff');
  end if;

  select exam_id
  into v_exam_id
  from timeslots
  where id = p_timeslot_id
  for update;

  if v_exam_id is null then
    return jsonb_build_object('ok', false, 'error', 'timeslot_not_found');
  end if;

  select exists (
    select 1
    from timeslot_draws
    where timeslot_id = p_timeslot_id
  ) into v_existing;

  if v_existing and coalesce(p_force, false) is not true then
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'timeslot_id', p_timeslot_id
    );
  end if;

  if coalesce(p_force, false) then
    select exists (
      select 1
      from test_instances
      where timeslot_id = p_timeslot_id
        and started_at is not null
    ) into v_started;

    if v_started then
      return jsonb_build_object(
        'ok', false,
        'error', 'Redraw refused: a student has already started this timeslot.'
      );
    end if;
  end if;

  select coalesce(array_agg(distinct section.subject order by section.subject), '{}'::text[])
  into v_subjects
  from exam_sections section
  where section.exam_id = v_exam_id
    and section.subject is not null;

  if coalesce(cardinality(v_subjects), 0) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'This exam has no subject on its sections.'
    );
  end if;

  foreach v_subject in array v_subjects loop
    select questions_per_category
    into v_need
    from subject_settings
    where subject = v_subject;

    if v_need is null then
      return jsonb_build_object(
        'ok', false,
        'error', v_subject || ': missing subject settings'
      );
    end if;

    if not exists (
      select 1
      from questions q
      where q.subject = v_subject
        and public.question_category_is_topic(q.category)
    ) then
      if v_errors <> '' then
        v_errors := v_errors || '; ';
      end if;
      v_errors := v_errors || v_subject || ': no topics to draw';
      continue;
    end if;

    for v_topic in
      select q.category as category, count(*)::integer as have
      from questions q
      where q.subject = v_subject
        and public.question_category_is_topic(q.category)
      group by q.category
      order by q.category
    loop
      v_expected := v_expected + v_need;
      if v_topic.have < v_need then
        if v_errors <> '' then
          v_errors := v_errors || '; ';
        end if;
        v_errors := v_errors
          || v_topic.category
          || ': has '
          || v_topic.have::text
          || ', needs '
          || v_need::text;
      end if;
    end loop;
  end loop;

  if v_errors <> '' then
    return jsonb_build_object('ok', false, 'error', v_errors);
  end if;

  -- Replacement rows only. Not run unless a staff member passes p_force
  -- and nobody has started this timeslot. Validated above, so a short
  -- bank does not remove an existing draw.
  if coalesce(p_force, false) and v_existing then
    delete from timeslot_draws
    where timeslot_id = p_timeslot_id;
  end if;

  foreach v_subject in array v_subjects loop
    select questions_per_category
    into v_need
    from subject_settings
    where subject = v_subject;

    for v_topic in
      select q.category as category
      from questions q
      where q.subject = v_subject
        and public.question_category_is_topic(q.category)
      group by q.category
      order by q.category
    loop
      v_position := 0;
      for v_question_id in
        select q.id
        from questions q
        where q.subject = v_subject
          and q.category = v_topic.category
          and public.question_category_is_topic(q.category)
        order by random()
        limit v_need
      loop
        v_position := v_position + 1;
        insert into timeslot_draws (timeslot_id, subject, question_id, position)
        values (p_timeslot_id, v_subject, v_question_id, v_position);
        v_inserted := v_inserted + 1;
      end loop;
    end loop;
  end loop;

  if v_inserted <> v_expected then
    raise exception 'category draw changed while preparing this timeslot'
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'ok', true,
    'unchanged', false,
    'timeslot_id', p_timeslot_id,
    'drawn', v_inserted
  );
end;
$$;

revoke all on function public.draw_timeslot_questions(uuid, boolean) from public;
revoke all on function public.draw_timeslot_questions(uuid, boolean) from anon;
grant execute on function public.draw_timeslot_questions(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- start_session
-- Same body as migration_016 except each section's question_ids.
-- section_plan shape is unchanged. Resume, catch-up, and the flat path
-- are unchanged.
-- ---------------------------------------------------------------------------

create or replace function start_session(
  p_token text,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance record;
  v_exam record;
  v_sec record;
  v_has_timeslots boolean;
  v_has_sections boolean;
  v_question_set text;
  v_timeslot_id uuid;
  v_assigned jsonb;
  v_session_id text;
  v_questions jsonb;
  v_instance_id uuid;
  v_exam_id uuid;
  v_expires_at timestamptz;
  v_status text;
  v_section_plan jsonb;
  v_section_index integer;
  v_section_started timestamptz;
  v_payload_ids jsonb;
  v_section_json jsonb;
  v_caught jsonb;
  v_expected integer;
  v_ids jsonb;
  v_flat jsonb;
  v_use_draw boolean;
begin
  select id, exam_id, status, expires_at, assigned_question_ids,
         session_id, started_at, timeslot_id,
         current_section_index, section_started_at, section_plan
  into v_instance
  from test_instances
  where access_token = p_token
  for update;

  if v_instance is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_instance.status = 'submitted' then
    return jsonb_build_object('ok', false, 'error', 'already_submitted');
  end if;

  -- First scan: resolve timeslot / questions / expiry. Ignore any
  -- generate-time expires_at so the token stays valid until this moment.
  if v_instance.started_at is null then
    select id, duration_minutes, active_timeslot_override
    into v_exam
    from exams
    where id = v_instance.exam_id;

    if v_exam is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_token');
    end if;

    select exists(
      select 1 from exam_sections where exam_id = v_exam.id
    ) into v_has_sections;

    v_timeslot_id := null;
    v_section_plan := null;
    v_section_index := null;
    v_section_started := null;
    v_section_json := null;

    if v_has_sections then
      v_expected := 0;
      v_flat := '[]'::jsonb;
      v_section_plan := '[]'::jsonb;

      -- No timeslots: do not resolve. Every section keeps its own
      -- question_set, and timeslot_id stays null. That is the Test 2 path.
      select exists(
        select 1 from timeslots where exam_id = v_exam.id
      ) into v_has_timeslots;

      if v_has_timeslots then
        select resolved.timeslot_id
        into v_timeslot_id
        from public.resolve_exam_timeslot(
          v_exam.id,
          v_exam.active_timeslot_override
        ) as resolved;

        if v_timeslot_id is null then
          return jsonb_build_object('ok', false, 'error', 'invalid_token');
        end if;
      end if;

      for v_sec in
        select id, position, label, question_set, duration_minutes, subject
        from exam_sections
        where exam_id = v_exam.id
        order by position
      loop
        if v_sec.position <> v_expected then
          return jsonb_build_object('ok', false, 'error', 'invalid_sections');
        end if;
        v_expected := v_expected + 1;

        v_question_set := v_sec.question_set;
        if v_timeslot_id is not null then
          select mapped.question_set
          into v_question_set
          from section_timeslot_question_sets mapped
          where mapped.timeslot_id = v_timeslot_id
            and mapped.section_id = v_sec.id;
          if not found then
            v_question_set := v_sec.question_set;
          end if;
        end if;

        -- Frozen draw for this timeslot and this section's subject.
        -- The plan still records the section question_set above.
        v_use_draw := false;
        v_ids := null;
        if v_timeslot_id is not null and v_sec.subject is not null then
          select exists (
            select 1
            from timeslot_draws drawn
            where drawn.timeslot_id = v_timeslot_id
              and drawn.subject = v_sec.subject
          ) into v_use_draw;
        end if;

        if v_use_draw then
          select coalesce(jsonb_agg(picked.id order by picked.ord), '[]'::jsonb)
          into v_ids
          from (
            select drawn.question_id::text as id,
                   row_number() over (
                     order by bank.category, drawn.position, drawn.question_id
                   ) as ord
            from timeslot_draws drawn
            join questions bank on bank.id = drawn.question_id
            where drawn.timeslot_id = v_timeslot_id
              and drawn.subject = v_sec.subject
          ) picked;

          if v_ids is null
             or jsonb_typeof(v_ids) <> 'array'
             or jsonb_array_length(v_ids) = 0 then
            v_use_draw := false;
          end if;
        end if;

        if not v_use_draw then
          select coalesce(jsonb_agg(picked.id order by picked.ord), '[]'::jsonb)
          into v_ids
          from (
            select q.id::text as id, row_number() over () as ord
            from (
              select id
              from questions
              where question_set = v_question_set
              order by random()
            ) q
          ) picked;
        end if;

        v_section_plan := v_section_plan || jsonb_build_array(
          jsonb_build_object(
            'position', v_sec.position,
            'label', v_sec.label,
            'question_set', v_question_set,
            'duration_minutes', v_sec.duration_minutes,
            'question_ids', v_ids
          )
        );
        v_flat := v_flat || v_ids;
      end loop;

      select coalesce(jsonb_agg(d.id order by d.ord), '[]'::jsonb)
      into v_assigned
      from (
        select t.id, min(t.ord) as ord
        from jsonb_array_elements_text(v_flat) with ordinality as t(id, ord)
        group by t.id
      ) d;

      v_section_index := 0;
      v_section_started := now();
      v_section_json := exam_section_view(v_section_plan, 0, v_section_started);
      v_expires_at := (v_section_json->>'ends_at')::timestamptz;
      v_payload_ids := v_section_plan->0->'question_ids';
    else
      select exists(
        select 1 from timeslots where exam_id = v_exam.id
      ) into v_has_timeslots;

      v_assigned := v_instance.assigned_question_ids;

      if not v_has_timeslots then
        v_question_set := 'General';
        if v_assigned is null
           or jsonb_typeof(v_assigned) <> 'array'
           or jsonb_array_length(v_assigned) = 0 then
          select coalesce(jsonb_agg(s.id), '[]'::jsonb)
          into v_assigned
          from (
            select id
            from questions
            where question_set = v_question_set
            order by random()
          ) s;
        end if;
      else
        select resolved.timeslot_id, resolved.question_set
        into v_timeslot_id, v_question_set
        from public.resolve_exam_timeslot(
          v_exam.id,
          v_exam.active_timeslot_override
        ) as resolved;

        if v_timeslot_id is null then
          return jsonb_build_object('ok', false, 'error', 'invalid_token');
        end if;

        -- Every question in the timeslot's set. Do not sample by the
        -- pre-scan assigned_question_ids count.
        select coalesce(jsonb_agg(s.id), '[]'::jsonb)
        into v_assigned
        from (
          select id
          from questions
          where question_set = v_question_set
          order by random()
        ) s;
      end if;

      v_expires_at := now() + make_interval(mins => v_exam.duration_minutes);
      v_payload_ids := v_assigned;
    end if;

    v_session_id := replace(gen_random_uuid()::text, '-', '');
    v_instance_id := v_instance.id;
    v_exam_id := v_exam.id;
    v_status := 'in_progress';

    update test_instances
    set
      started_at = now(),
      status = v_status,
      session_id = v_session_id,
      expires_at = v_expires_at,
      assigned_question_ids = v_assigned,
      timeslot_id = v_timeslot_id,
      current_section_index = v_section_index,
      section_started_at = v_section_started,
      section_plan = v_section_plan
    where id = v_instance_id;

  else
    if v_instance.section_plan is not null then
      if p_session_id is null or p_session_id <> v_instance.session_id then
        return jsonb_build_object('ok', false, 'error', 'session_already_active');
      end if;

      v_caught := exam_section_catch_up(v_instance.id);
      if v_caught->>'status' = 'submitted' then
        return jsonb_build_object('ok', false, 'error', 'expired');
      end if;

      v_assigned := v_instance.assigned_question_ids;
      v_session_id := v_instance.session_id;
      v_instance_id := v_instance.id;
      v_exam_id := v_instance.exam_id;
      v_status := 'in_progress';
      v_expires_at := (v_caught->>'ends_at')::timestamptz;
      v_payload_ids := v_caught->'question_ids';
      v_section_json := exam_section_view(
        v_instance.section_plan,
        (v_caught->>'index')::integer,
        (v_caught->>'started_at')::timestamptz
      );
    else
      if v_instance.expires_at is not null and v_instance.expires_at < now() then
        update test_instances
        set status = 'submitted', submitted_at = coalesce(submitted_at, now())
        where id = v_instance.id and status in ('pending', 'in_progress');
        return jsonb_build_object('ok', false, 'error', 'expired');
      end if;

      if p_session_id is null or p_session_id <> v_instance.session_id then
        return jsonb_build_object('ok', false, 'error', 'session_already_active');
      end if;

      v_assigned := v_instance.assigned_question_ids;
      v_session_id := v_instance.session_id;
      v_instance_id := v_instance.id;
      v_exam_id := v_instance.exam_id;
      v_expires_at := v_instance.expires_at;
      v_status := v_instance.status;
      v_payload_ids := v_assigned;
      v_section_json := null;
    end if;
  end if;

  v_questions := exam_section_questions(v_payload_ids);

  return jsonb_build_object(
    'ok', true,
    'instance_id', v_instance_id,
    'exam_id', v_exam_id,
    'expires_at', v_expires_at,
    'status', v_status,
    'session_id', v_session_id,
    'questions', v_questions,
    'section', v_section_json
  );
end;
$$;

revoke execute on function start_session(text, text) from public;
revoke execute on function start_session(text, text) from authenticated;
grant execute on function start_session(text, text) to anon;

-- ---------------------------------------------------------------------------
-- submit_answer
-- Same body as migration_013, plus fraction grading.
-- 2/6 is a normal wrong answer when the stored answer is 1/3.
-- b = 0 and non-integers are refused and not stored.
-- advance_section is not replaced. It already reads question_ids by id.
-- ---------------------------------------------------------------------------

create or replace function submit_answer(
  p_token text,
  p_session_id text,
  p_question_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance record;
  v_question record;
  v_is_correct boolean;
  v_needs_review boolean;
  v_assigned_ids text[];
  v_current_ids text[];
  v_caught jsonb;
  v_fraction text;
  v_num integer;
  v_den integer;
begin
  select id, status, expires_at, assigned_question_ids, session_id, section_plan
  into v_instance
  from test_instances
  where access_token = p_token
  for update;

  if v_instance is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if p_session_id is null or p_session_id <> v_instance.session_id then
    return jsonb_build_object('ok', false, 'error', 'invalid_session_id');
  end if;

  if v_instance.section_plan is not null then
    if v_instance.status = 'submitted' then
      return jsonb_build_object('ok', false, 'error', 'already_submitted');
    end if;

    if v_instance.status <> 'in_progress' then
      return jsonb_build_object('ok', false, 'error', 'not_in_progress');
    end if;

    v_caught := exam_section_catch_up(v_instance.id);
    if v_caught->>'status' = 'submitted' then
      return jsonb_build_object('ok', false, 'error', 'expired');
    end if;

    select coalesce(array_agg(value), '{}'::text[])
    into v_current_ids
    from jsonb_array_elements_text(coalesce(v_caught->'question_ids', '[]'::jsonb));

    if not (p_question_id::text = any(v_current_ids)) then
      select coalesce(array_agg(value), '{}'::text[])
      into v_assigned_ids
      from jsonb_array_elements_text(coalesce(v_instance.assigned_question_ids, '[]'::jsonb));

      if p_question_id::text = any(v_assigned_ids) then
        return jsonb_build_object('ok', false, 'error', 'section_locked');
      end if;
      return jsonb_build_object('ok', false, 'error', 'question_not_assigned');
    end if;
  else
    if v_instance.expires_at is not null and v_instance.expires_at < now() then
      update test_instances
      set status = 'submitted', submitted_at = coalesce(submitted_at, now())
      where id = v_instance.id and status in ('pending', 'in_progress');
      return jsonb_build_object('ok', false, 'error', 'expired');
    end if;

    if v_instance.status <> 'in_progress' then
      return jsonb_build_object('ok', false, 'error', 'not_in_progress');
    end if;

    select array_agg(value::text)
    into v_assigned_ids
    from jsonb_array_elements_text(v_instance.assigned_question_ids);

    if p_question_id::text <> all(v_assigned_ids) then
      return jsonb_build_object('ok', false, 'error', 'question_not_assigned');
    end if;
  end if;

  select type, correct_answer
  into v_question
  from questions
  where id = p_question_id;

  if v_question.type = 'fraction' then
    v_fraction := trim(coalesce(p_answer, ''));
    if v_fraction !~ '^-?(0|[1-9][0-9]*)/[0-9]+$'
       or v_fraction ~ '^-0/' then
      return jsonb_build_object('ok', false, 'error', 'invalid_fraction');
    end if;
    begin
      v_num := split_part(v_fraction, '/', 1)::integer;
      v_den := split_part(v_fraction, '/', 2)::integer;
    exception
      when others then
        return jsonb_build_object('ok', false, 'error', 'invalid_fraction');
    end;
    if v_num is null or v_den is null or v_den = 0 then
      return jsonb_build_object('ok', false, 'error', 'invalid_fraction');
    end if;
    -- Exact text. Do not reduce 2/6 to 1/3.
    v_is_correct := v_fraction = trim(coalesce(v_question.correct_answer, ''));
  elsif v_question.type = 'numeric' then
    begin
      v_is_correct := abs(p_answer::numeric - v_question.correct_answer::numeric) <= 0.01;
    exception when others then
      v_is_correct := false;
    end;
  else
    v_is_correct := lower(trim(p_answer)) = lower(trim(v_question.correct_answer));
  end if;

  -- Explicit requirement: every text-type (open-ended) answer must be
  -- flagged for manual human review, regardless of what the string-match
  -- comparison above computed for v_is_correct.
  v_needs_review := (v_question.type = 'text');

  insert into responses (test_instance_id, question_id, student_answer, is_correct, graded_by, needs_review, updated_at)
  values (v_instance.id, p_question_id, p_answer, v_is_correct, 'auto', v_needs_review, now())
  on conflict (test_instance_id, question_id)
  do update set
    student_answer = excluded.student_answer,
    is_correct = excluded.is_correct,
    needs_review = excluded.needs_review,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'is_correct', v_is_correct,
    'graded_by', 'auto',
    'needs_review', v_needs_review
  );
end;
$$;

revoke execute on function submit_answer(text, text, uuid, text) from public;
revoke execute on function submit_answer(text, text, uuid, text) from authenticated;
grant execute on function submit_answer(text, text, uuid, text) to anon;
