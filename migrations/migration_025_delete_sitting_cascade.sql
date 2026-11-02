-- migration_025_delete_sitting_cascade.sql
-- Proposed. Do not apply until reviewed.
-- Depends on migration_023 (the current start_session) and migration_017
-- (timeslot_draws). Does not edit any earlier migration file.
--
-- HIGH RISK
-- * Adds timeslots.archived_at. No new RLS policy and no new table grant.
--   timeslots_update_staff already lets staff update every column, so a
--   teacher can set archived_at. That is intentional.
-- * Replaces public.resolve_exam_timeslot so an archived sitting is not
--   chosen for a new student. Grants on that function stay revoked.
-- * Replaces start_session. The body is migration_023 with one extra
--   predicate on both "does this exam have timeslots" checks:
--   and archived_at is null. Grants are restated and not widened:
--   anon may execute it; public and authenticated may not.
-- * Adds public.delete_sitting_test_data(uuid, text). SECURITY DEFINER.
--   EXECUTE is granted to authenticated and revoked from anon and public.
--   The function itself returns not_admin unless public.is_admin() is true,
--   and it does nothing unless p_confirm is exactly DELETE.
-- * The function deletes rows. It does not change RLS policies.
--
-- Tables that reference a sitting (timeslots.id)
-- Direct foreign keys:
-- * exams.active_timeslot_override -> timeslots(id)
--     migration_006. No ON DELETE action. Cleared before the sitting is removed.
-- * test_instances.timeslot_id -> timeslots(id)
--     migration_006. No ON DELETE action. This is why a started sitting
--     cannot be deleted with a plain DELETE.
-- * section_timeslot_question_sets.timeslot_id -> timeslots(id) ON DELETE CASCADE
--     migration_016.
-- * timeslot_draws.timeslot_id -> timeslots(id) ON DELETE CASCADE
--     migration_017.
-- Rows that do not reference timeslots, but block removal of the linked
-- test_instances row:
-- * responses.test_instance_id -> test_instances(id)
--     supabase_schema.sql. No ON DELETE action. Deleted first.
-- * grades has no timeslot column. It is one row per student per exam
--     (grades_student_exam_key). A grade is removed when its student has a
--     test_instances row on this sitting. If that student also has another
--     instance on the same exam, the exam-level grade is still removed,
--     because the answers for this sitting are gone.
-- No other table in this repository references public.timeslots(id).

alter table public.timeslots
  add column if not exists archived_at timestamptz;

comment on column public.timeslots.archived_at is
  'Set while this sitting is hidden from the active list. Null means active. Data is kept.';

-- Archived sittings are not chosen for a new student. An override that
-- points at an archived sitting is ignored. Touching this function changes
-- which sitting start_session assigns.
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
      and t.exam_id = p_exam_id
      and t.archived_at is null;
  end if;

  if timeslot_id is null then
    select t.id, t.question_set
    into timeslot_id, question_set
    from timeslots t
    where t.exam_id = p_exam_id
      and t.archived_at is null
      and t.ends_at > now()
    order by t.starts_at asc
    limit 1;
  end if;

  if timeslot_id is null then
    select t.id, t.question_set
    into timeslot_id, question_set
    from timeslots t
    where t.exam_id = p_exam_id
      and t.archived_at is null
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
  v_use_draw boolean;
  v_duration integer;
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
        select 1 from timeslots
        where exam_id = v_exam.id
          and archived_at is null
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

          -- No rows for this subject: do not fall back to the whole set.
          if not v_use_draw then
            return jsonb_build_object('ok', false, 'error', 'not_prepared');
          end if;
        end if;

        if v_use_draw then
          select coalesce(jsonb_agg(picked.id order by picked.ord), '[]'::jsonb)
          into v_ids
          from (
            select drawn.question_id::text as id,
                   row_number() over (
                     order by topic.display_order nulls last,
                              bank.category,
                              drawn.position,
                              drawn.question_id
                   ) as ord
            from timeslot_draws drawn
            join questions bank on bank.id = drawn.question_id
            left join subject_topics topic
              on topic.subject = drawn.subject
             and topic.category = bank.category
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

        -- Before the first student starts, Math and Chinese minutes come
        -- from subject_settings. After that, later students keep the first
        -- student's snapshotted duration. A section with no subject keeps
        -- exam_sections.duration_minutes. The plan key stays duration_minutes.
        v_duration := v_sec.duration_minutes;
        if v_sec.subject is not null then
          if exists (
            select 1
            from test_instances started
            where started.exam_id = v_exam.id
              and started.started_at is not null
              and started.section_plan is not null
          ) then
            select (elem->>'duration_minutes')::integer
            into v_duration
            from test_instances started
            cross join lateral jsonb_array_elements(started.section_plan) elem
            where started.exam_id = v_exam.id
              and started.started_at is not null
              and (elem->>'position')::integer = v_sec.position
              and (elem->>'duration_minutes') ~ '^[0-9]+$'
              and (elem->>'duration_minutes')::integer > 0
            order by started.started_at, started.id
            limit 1;
            if v_duration is null then
              v_duration := v_sec.duration_minutes;
            end if;
          else
            select settings.duration_minutes
            into v_duration
            from subject_settings settings
            where settings.subject = v_sec.subject;
            if v_duration is null then
              v_duration := v_sec.duration_minutes;
            end if;
          end if;
        end if;

        v_section_plan := v_section_plan || jsonb_build_array(
          jsonb_build_object(
            'position', v_sec.position,
            'label', v_sec.label,
            'question_set', v_question_set,
            'duration_minutes', v_duration,
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
        select 1 from timeslots
        where exam_id = v_exam.id
          and archived_at is null
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

-- Admin-only permanent delete. The app must pass p_confirm = 'DELETE'.
-- Counts match the Sittings page preview:
-- * students = distinct student_id, plus instances with no student
-- * answers = responses on those instances
-- * results = grades for those students on this exam
create or replace function public.delete_sitting_test_data(
  p_timeslot_id uuid,
  p_confirm text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
  v_students integer;
  v_answers integer;
  v_results integer;
  v_student_ids uuid[];
begin
  if coalesce(public.is_admin(), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;

  if p_confirm is distinct from 'DELETE' then
    return jsonb_build_object('ok', false, 'error', 'confirm_delete');
  end if;

  select exam_id
  into v_exam_id
  from timeslots
  where id = p_timeslot_id
  for update;

  if v_exam_id is null then
    return jsonb_build_object('ok', false, 'error', 'timeslot_not_found');
  end if;

  perform id
  from test_instances
  where timeslot_id = p_timeslot_id
  for update;

  select
    coalesce(count(distinct student_id) filter (where student_id is not null), 0)
    + coalesce(count(*) filter (where student_id is null), 0)
  into v_students
  from test_instances
  where timeslot_id = p_timeslot_id;

  select coalesce(count(*), 0)
  into v_answers
  from responses
  where test_instance_id in (
    select id from test_instances where timeslot_id = p_timeslot_id
  );

  select coalesce(array_agg(distinct student_id), '{}'::uuid[])
  into v_student_ids
  from test_instances
  where timeslot_id = p_timeslot_id
    and student_id is not null;

  if v_student_ids is null then
    v_student_ids := '{}'::uuid[];
  end if;

  select coalesce(count(*), 0)
  into v_results
  from grades
  where exam_id = v_exam_id
    and student_id = any(v_student_ids);

  delete from responses
  where test_instance_id in (
    select id from test_instances where timeslot_id = p_timeslot_id
  );

  delete from grades
  where exam_id = v_exam_id
    and student_id = any(v_student_ids);

  delete from test_instances
  where timeslot_id = p_timeslot_id;

  update exams
  set active_timeslot_override = null
  where id = v_exam_id
    and active_timeslot_override = p_timeslot_id;

  delete from timeslots
  where id = p_timeslot_id
    and exam_id = v_exam_id;

  return jsonb_build_object(
    'ok', true,
    'students', v_students,
    'answers', v_answers,
    'results', v_results
  );
end;
$$;

revoke all on function public.delete_sitting_test_data(uuid, text) from public;
revoke all on function public.delete_sitting_test_data(uuid, text) from anon;
grant execute on function public.delete_sitting_test_data(uuid, text) to authenticated;
