-- migration_030_resume_saved_answers.sql
-- UNAPPLIED. Do not apply until reviewed. HIGH RISK.
-- Depends on migration_025 (the live start_session) and on responses
-- (test_instance_id, question_id, student_answer). Does not edit any
-- earlier migration file.
--
-- HIGH RISK
-- * Replaces start_session. The body is the migration_025 function plus
--   one extra key on the success payload: saved_answers.
-- * saved_answers is a JSON object of question id -> this student's
--   student_answer for the test_instances row locked by p_token, and only
--   after the existing session_id check has passed.
-- * The answer key is not read. is_correct is not read. access_token is
--   not returned. No other student's rows are read.
-- * No new table, column, policy, or grant. RLS is unchanged.
-- * Grants are restated and not widened: anon may execute start_session;
--   public and authenticated may not.
-- * No DELETE, DROP, or data change.
--
-- Rollback
-- Re-apply only the start_session function from migration_025 (from
-- "create or replace function start_session" through
-- "grant execute on function start_session(text, text) to anon").
-- Do not re-apply the rest of migration_025. That restores the previous
-- payload, which has no saved_answers key. Nothing else was changed, so
-- there is no data to put back.

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
  v_saved_answers jsonb;
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

  -- This student's answers for this instance only. question_id -> student_answer.
  -- Does not read questions, so the answer key is not loaded. is_correct is not loaded.
  select coalesce(jsonb_object_agg(picked.question_id, to_jsonb(picked.student_answer)), '{}'::jsonb)
  into v_saved_answers
  from (
    select distinct on (r.question_id)
      r.question_id::text as question_id,
      r.student_answer
    from responses r
    where r.test_instance_id = v_instance_id
      and r.student_answer is not null
    order by r.question_id, r.id
  ) picked;

  v_questions := exam_section_questions(v_payload_ids);

  return jsonb_build_object(
    'ok', true,
    'instance_id', v_instance_id,
    'exam_id', v_exam_id,
    'expires_at', v_expires_at,
    'status', v_status,
    'session_id', v_session_id,
    'questions', v_questions,
    'section', v_section_json,
    'saved_answers', v_saved_answers
  );
end;
$$;



revoke execute on function start_session(text, text) from public;
revoke execute on function start_session(text, text) from authenticated;
grant execute on function start_session(text, text) to anon;
