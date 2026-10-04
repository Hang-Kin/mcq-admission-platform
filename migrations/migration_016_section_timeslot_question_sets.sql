-- migration_016_section_timeslot_question_sets.sql
-- Proposed. Do not apply until reviewed.
-- HIGH RISK: replaces start_session. Diff against
-- pg_get_functiondef('start_session'::regproc) before apply.
-- Latest migration in the repo is 015, so this is 016.
--
-- Per-timeslot question sets for sectioned exams.
-- Flat exams (no exam_sections rows) keep today's draw. Their resolution
-- now calls resolve_exam_timeslot instead of inlining the same three
-- selects. The predicates are unchanged; see that function.
--
-- Flat-mode resolution, as it stands in migration_013 start_session
-- (the else branch, only when the exam has at least one timeslot):
--   1. If exams.active_timeslot_override is not null, load that timeslot
--      where id = override AND exam_id = this exam. A missing or
--      other-exam id leaves the slot unset and falls through.
--   2. If still unset, among timeslots with ends_at > now(), pick the
--      earliest starts_at (current window, or the next one in a gap).
--   3. If still unset, pick the latest starts_at (every window has ended).
--   4. If that is still null, return invalid_token.
--   5. Draw every question in that timeslot's question_set, order by
--      random(). Store timeslot_id. Zero timeslots still means the
--      General set (or a pre-assigned list) and timeslot_id stays null.
--      That zero-timeslot branch is not sent through the helper.
--
-- Sectioned branch (exam_sections rows exist), first scan only:
--   * Zero timeslots: do not call the helper. Each section draws from
--     exam_sections.question_set. timeslot_id stays null. This is Test 2.
--   * Otherwise resolve one timeslot with the helper above. Null result
--     is invalid_token, same as flat mode.
--   * For each section in position order, use
--     section_timeslot_question_sets.question_set for
--     (resolved timeslot, section) when a row exists. Otherwise use
--     exam_sections.question_set. A missing row is not an error.
--   * The snapshot stores the set the questions were actually drawn
--     from. order by random() is unchanged.
--   * Store the resolved timeslot_id on test_instances.
-- Re-entry, advance_section, and submit_answer are not modified.
--
-- Anon has no privileges on the new table. start_session reads it as
-- security definer, the same way it reads exam_sections and timeslots.

create table public.section_timeslot_question_sets (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id),
  timeslot_id uuid not null references public.timeslots(id) on delete cascade,
  section_id uuid not null references public.exam_sections(id) on delete cascade,
  question_set text not null check (char_length(btrim(question_set)) > 0),
  created_at timestamptz default now(),
  unique (timeslot_id, section_id)
);

create index section_timeslot_question_sets_exam_id_idx
  on public.section_timeslot_question_sets (exam_id);

alter table public.section_timeslot_question_sets enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'section_timeslot_question_sets'
  loop
    execute format(
      'drop policy if exists %I on public.section_timeslot_question_sets',
      r.policyname
    );
  end loop;
end
$$;

create policy "section_timeslot_question_sets_select_staff"
  on public.section_timeslot_question_sets
  for select to authenticated using (is_staff());
create policy "section_timeslot_question_sets_insert_staff"
  on public.section_timeslot_question_sets
  for insert to authenticated with check (is_staff());
create policy "section_timeslot_question_sets_update_staff"
  on public.section_timeslot_question_sets
  for update to authenticated using (is_staff());
create policy "section_timeslot_question_sets_delete_admin"
  on public.section_timeslot_question_sets
  for delete to authenticated using (is_admin());

revoke all on table public.section_timeslot_question_sets from public;
revoke all on table public.section_timeslot_question_sets from anon;
grant select, insert, update, delete
  on table public.section_timeslot_question_sets to authenticated;

-- exam_id is denormalized for staff queries. Reject a row whose timeslot
-- or section belongs to a different exam.
create or replace function public.section_timeslot_question_sets_same_exam()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timeslot_exam uuid;
  v_section_exam uuid;
begin
  select exam_id into v_timeslot_exam from timeslots where id = new.timeslot_id;
  select exam_id into v_section_exam from exam_sections where id = new.section_id;
  if v_timeslot_exam is null
     or v_section_exam is null
     or v_timeslot_exam is distinct from new.exam_id
     or v_section_exam is distinct from new.exam_id then
    raise exception 'section timeslot question set must belong to one exam'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists section_timeslot_question_sets_same_exam
  on public.section_timeslot_question_sets;
create trigger section_timeslot_question_sets_same_exam
  before insert or update on public.section_timeslot_question_sets
  for each row
  execute function public.section_timeslot_question_sets_same_exam();

revoke all on function public.section_timeslot_question_sets_same_exam() from public;
revoke all on function public.section_timeslot_question_sets_same_exam() from anon;
revoke all on function public.section_timeslot_question_sets_same_exam() from authenticated;

-- Single copy of the flat-mode timeslot pick. Both start_session branches
-- call this. Zero timeslots is handled by the caller, not here.
create or replace function public.resolve_exam_timeslot(
  p_exam_id uuid,
  p_active_timeslot_override uuid,
  out timeslot_id uuid,
  out question_set text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  timeslot_id := null;
  question_set := null;

  if p_active_timeslot_override is not null then
    select t.id, t.question_set
    into timeslot_id, question_set
    from timeslots t
    where t.id = p_active_timeslot_override
      and t.exam_id = p_exam_id;
  end if;

  if timeslot_id is null then
    select t.id, t.question_set
    into timeslot_id, question_set
    from timeslots t
    where t.exam_id = p_exam_id
      and t.ends_at > now()
    order by t.starts_at asc
    limit 1;
  end if;

  if timeslot_id is null then
    select t.id, t.question_set
    into timeslot_id, question_set
    from timeslots t
    where t.exam_id = p_exam_id
    order by t.starts_at desc
    limit 1;
  end if;
end;
$$;

revoke all on function public.resolve_exam_timeslot(uuid, uuid) from public;
revoke all on function public.resolve_exam_timeslot(uuid, uuid) from anon;
revoke all on function public.resolve_exam_timeslot(uuid, uuid) from authenticated;

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
        select id, position, label, question_set, duration_minutes
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
