-- migration_018_subject_duration.sql
-- Proposed. Do not apply until reviewed.
-- Depends on migration_017 (subject_settings, timeslot_draws, start_session).
--
-- HIGH RISK
-- * Replaces start_session. It stays SECURITY DEFINER. Grants are unchanged:
--   anon may execute it; public and authenticated may not.
-- * New RLS on subject_topics only. Staff policies, no anon policies, no
--   grants to anon. No existing policy is changed.
-- * Does not touch proxy.ts, .env, grading, or existing tables' policies.
--
-- What this file adds
-- * subject_topics.display_order. One row per subject and topic name.
--   Topics with a row are shown in that order. Topics with no row stay in
--   alphabetical order after the numbered ones. No rows are seeded, so a
--   bank with no order rows is still alphabetical.
-- * For a section whose subject is set, the snapshotted duration_minutes
--   comes from subject_settings.duration_minutes (Math 7, Chinese 8 unless
--   a teacher changed them). A section with a null subject keeps
--   exam_sections.duration_minutes. Flat exams are unchanged.
--
-- section_plan keys stay position, label, question_set, duration_minutes,
-- question_ids. No DELETE, DROP TABLE, or TRUNCATE. The policy cleanup
-- below only runs against the new subject_topics table.

-- ---------------------------------------------------------------------------
-- subject_topics
-- HIGH RISK: new table RLS. Staff only. No anon.
-- ---------------------------------------------------------------------------

create table public.subject_topics (
  subject text not null check (subject in ('Math', 'Chinese')),
  category text not null check (char_length(btrim(category)) > 0),
  display_order integer not null check (display_order > 0),
  primary key (subject, category),
  unique (subject, display_order)
);

alter table public.subject_topics enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subject_topics'
  loop
    execute format(
      'drop policy if exists %I on public.subject_topics',
      r.policyname
    );
  end loop;
end
$$;

create policy "subject_topics_select_staff"
  on public.subject_topics
  for select to authenticated using (is_staff());
create policy "subject_topics_insert_staff"
  on public.subject_topics
  for insert to authenticated with check (is_staff());
create policy "subject_topics_update_staff"
  on public.subject_topics
  for update to authenticated using (is_staff());
create policy "subject_topics_delete_admin"
  on public.subject_topics
  for delete to authenticated using (is_admin());

revoke all on table public.subject_topics from public;
revoke all on table public.subject_topics from anon;
grant select, insert, update, delete
  on table public.subject_topics to authenticated;

-- ---------------------------------------------------------------------------
-- start_session
-- Same body as migration_017 except topic order and section duration.
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

        -- Subject sections time from subject_settings. The plan key stays
        -- duration_minutes, so catch-up and advance keep using this snapshot.
        -- A missing settings row keeps the section's own duration.
        v_duration := v_sec.duration_minutes;
        if v_sec.subject is not null then
          select settings.duration_minutes
          into v_duration
          from subject_settings settings
          where settings.subject = v_sec.subject;
          if v_duration is null then
            v_duration := v_sec.duration_minutes;
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
