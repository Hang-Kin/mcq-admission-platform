-- migration_013_exam_sections.sql
-- Proposed. Do not apply until reviewed.
--
-- Timed exam sections. An exam with zero exam_sections rows keeps the
-- migration_012 start_session / migration_004 submit_answer behavior.
-- start_session then returns "section": null.
--
-- An exam with one or more sections:
--   * Sections replace timeslot and "General" question draws. Timeslot
--     resolution is skipped (timeslot_id stays null) even if timeslots exist.
--   * exams.duration_minutes is not the student timer. Each section has its
--     own duration_minutes. expires_at tracks the current section deadline
--     so existing readers of that column stay aligned with the section clock.
--   * On first scan, each section is snapshotted into
--     test_instances.section_plan (label, question_set, duration_minutes,
--     shuffled question ids). Later edits to exam_sections apply only to
--     sittings that have not started. current_section_index matches
--     exam_sections.position (contiguous, starting at 0).
--   * assigned_question_ids is every section's questions, in section order,
--     deduped, so grading still scores out of the full paper. start_session
--     and advance_section return only the current section's questions.
--   * A section deadline is section_started_at + that section's snapshotted
--     duration. The next section starts when the previous one ended, including
--     when the student was offline, so missed time burns through later
--     sections instead of restarting their clocks.
--   * The last section expiring marks the instance submitted (same columns
--     as the in-request expiry path: status submitted, submitted_at set).
--
-- advance_section(p_token, p_session_id, p_from_index)
--   Granted to anon only, same as the other student RPCs.
--   p_from_index is the section the client believes it is leaving. If the
--   server has already moved on (retry, or the deadline passed inside an
--   earlier request), the call does not skip another section: it returns
--   the section the student is on now, with already_advanced = true.
--   Top-level is_last is true only when this call ended the exam.
--   section.is_last is true when the section being shown has no successor.
--   Those are different: the student is still inside the final section
--   when section.is_last is true and top-level is_last is false.
--
--   Success while the exam continues:
--     { ok, is_last: false, already_advanced, status: "in_progress",
--       instance_id, exam_id, session_id, expires_at, section, questions }
--   Success when the exam is now submitted:
--     { ok, is_last: true, status: "submitted",
--       instance_id, exam_id, session_id, section: null, questions: [] }
--   Errors: invalid_token, invalid_session_id, not_in_progress,
--           not_sectioned, section_mismatch.
--
-- submit_answer on a sectioned sitting:
--   Catches the section clock up before grading. Answers for a section the
--   student has already left return section_locked and are not saved.
--   A question that was never assigned still returns question_not_assigned.
--   If catch-up submits the exam, the answer is not saved and the error
--   is expired.
--
-- Deletes: exam_sections_delete_admin (admin only). A delete is also
-- rejected once any test_instances row for that exam has started_at set
-- (section_delete_blocked). Staff may insert and update. In-progress
-- snapshots are not rewritten by those updates.
--
-- Depends on migration_012 start_session (image_url in the question
-- payload) and migration_006 timeslots (the non-section branch still
-- reads that table).

create table public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id),
  position integer not null check (position >= 0),
  label text not null check (char_length(btrim(label)) > 0),
  question_set text not null check (char_length(btrim(question_set)) > 0),
  duration_minutes integer not null check (duration_minutes > 0),
  created_at timestamptz default now(),
  unique (exam_id, position)
);

alter table public.test_instances
  add column current_section_index integer,
  add column section_started_at timestamptz,
  add column section_plan jsonb;

alter table public.exam_sections enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'exam_sections'
  loop
    execute format('drop policy if exists %I on public.exam_sections', r.policyname);
  end loop;
end
$$;

create policy "exam_sections_select_staff" on public.exam_sections
  for select to authenticated using (is_staff());
create policy "exam_sections_insert_staff" on public.exam_sections
  for insert to authenticated with check (is_staff());
create policy "exam_sections_update_staff" on public.exam_sections
  for update to authenticated using (is_staff());
create policy "exam_sections_delete_admin" on public.exam_sections
  for delete to authenticated using (is_admin());

revoke all on table public.exam_sections from public;
revoke all on table public.exam_sections from anon;
grant select, insert, update, delete on table public.exam_sections to authenticated;

create or replace function public.exam_sections_block_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from test_instances
    where exam_id = old.exam_id
      and started_at is not null
  ) then
    raise exception 'section_delete_blocked: a student has already started this exam'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists exam_sections_block_delete on public.exam_sections;
create trigger exam_sections_block_delete
  before delete on public.exam_sections
  for each row
  execute function public.exam_sections_block_delete();

-- Question payload shared with start_session. correct_answer is omitted.
create or replace function public.exam_section_questions(p_ids jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'type', q.type,
        'options', q.options,
        'category', q.category,
        'question_set', q.question_set,
        'image_url', q.image_url
      )
      order by t.ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements_text(coalesce(p_ids, '[]'::jsonb))
    with ordinality as t(question_id, ord)
  join questions q on q.id = t.question_id::uuid;
$$;

create or replace function public.exam_section_view(
  p_plan jsonb,
  p_index integer,
  p_started_at timestamptz
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'index', p_index,
    'position', (elem->>'position')::integer,
    'label', elem->>'label',
    'question_set', elem->>'question_set',
    'duration_minutes', (elem->>'duration_minutes')::integer,
    'started_at', p_started_at,
    'ends_at', p_started_at + make_interval(mins => (elem->>'duration_minutes')::integer),
    'is_last', not exists (
      select 1
      from jsonb_array_elements(p_plan) nxt
      where (nxt->>'position')::integer = p_index + 1
    )
  )
  from jsonb_array_elements(coalesce(p_plan, '[]'::jsonb)) elem
  where (elem->>'position')::integer = p_index
  limit 1;
$$;

-- Moves an in-progress sectioned sitting forward through any sections
-- whose snapshotted window has already ended. Does not early-finish.
create or replace function public.exam_section_catch_up(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance record;
  v_section jsonb;
  v_next jsonb;
  v_index integer;
  v_started timestamptz;
  v_duration integer;
  v_deadline timestamptz;
begin
  select id, status, exam_id, section_plan, current_section_index,
         section_started_at, expires_at
  into v_instance
  from test_instances
  where id = p_instance_id
  for update;

  if v_instance.section_plan is null then
    return jsonb_build_object('sectioned', false);
  end if;

  if v_instance.status = 'submitted' then
    return jsonb_build_object(
      'sectioned', true,
      'status', 'submitted',
      'submitted_now', false
    );
  end if;

  v_index := v_instance.current_section_index;
  v_started := v_instance.section_started_at;

  loop
    v_section := null;
    select elem
    into v_section
    from jsonb_array_elements(v_instance.section_plan) elem
    where (elem->>'position')::integer = v_index
    limit 1;

    if v_section is null then
      update test_instances
      set status = 'submitted',
          submitted_at = coalesce(submitted_at, now())
      where id = p_instance_id
        and status = 'in_progress';
      return jsonb_build_object(
        'sectioned', true,
        'status', 'submitted',
        'submitted_now', true
      );
    end if;

    v_duration := (v_section->>'duration_minutes')::integer;
    v_deadline := v_started + make_interval(mins => v_duration);

    if v_deadline > now() then
      if v_index is distinct from v_instance.current_section_index
         or v_started is distinct from v_instance.section_started_at
         or v_deadline is distinct from v_instance.expires_at then
        update test_instances
        set current_section_index = v_index,
            section_started_at = v_started,
            expires_at = v_deadline
        where id = p_instance_id;
      end if;

      return jsonb_build_object(
        'sectioned', true,
        'status', 'in_progress',
        'submitted_now', false,
        'index', v_index,
        'started_at', v_started,
        'ends_at', v_deadline,
        'question_ids', coalesce(v_section->'question_ids', '[]'::jsonb)
      );
    end if;

    v_next := null;
    select elem
    into v_next
    from jsonb_array_elements(v_instance.section_plan) elem
    where (elem->>'position')::integer = v_index + 1
    limit 1;

    if v_next is null then
      update test_instances
      set status = 'submitted',
          submitted_at = coalesce(submitted_at, now()),
          current_section_index = v_index,
          section_started_at = v_started,
          expires_at = v_deadline
      where id = p_instance_id
        and status = 'in_progress';
      return jsonb_build_object(
        'sectioned', true,
        'status', 'submitted',
        'submitted_now', true,
        'index', v_index,
        'ends_at', v_deadline
      );
    end if;

    v_index := v_index + 1;
    v_started := v_deadline;
  end loop;
end;
$$;

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
  v_timeslot record;
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

      for v_sec in
        select position, label, question_set, duration_minutes
        from exam_sections
        where exam_id = v_exam.id
        order by position
      loop
        if v_sec.position <> v_expected then
          return jsonb_build_object('ok', false, 'error', 'invalid_sections');
        end if;
        v_expected := v_expected + 1;

        select coalesce(jsonb_agg(picked.id order by picked.ord), '[]'::jsonb)
        into v_ids
        from (
          select q.id::text as id, row_number() over () as ord
          from (
            select id
            from questions
            where question_set = v_sec.question_set
            order by random()
          ) q
        ) picked;

        v_section_plan := v_section_plan || jsonb_build_array(
          jsonb_build_object(
            'position', v_sec.position,
            'label', v_sec.label,
            'question_set', v_sec.question_set,
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

      v_timeslot := null;
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
        if v_exam.active_timeslot_override is not null then
          select *
          into v_timeslot
          from timeslots
          where id = v_exam.active_timeslot_override
            and exam_id = v_exam.id;
        end if;

        if v_timeslot is null then
          select *
          into v_timeslot
          from timeslots
          where exam_id = v_exam.id
            and ends_at > now()
          order by starts_at asc
          limit 1;
        end if;

        if v_timeslot is null then
          select *
          into v_timeslot
          from timeslots
          where exam_id = v_exam.id
          order by starts_at desc
          limit 1;
        end if;

        if v_timeslot is null then
          return jsonb_build_object('ok', false, 'error', 'invalid_token');
        end if;

        v_timeslot_id := v_timeslot.id;
        v_question_set := v_timeslot.question_set;

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

  if v_question.type = 'numeric' then
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

create or replace function advance_section(
  p_token text,
  p_session_id text,
  p_from_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance record;
  v_caught jsonb;
  v_index integer;
  v_next jsonb;
  v_started timestamptz;
  v_duration integer;
  v_ends timestamptz;
  v_section jsonb;
  v_questions jsonb;
begin
  select id, exam_id, status, session_id, section_plan, current_section_index
  into v_instance
  from test_instances
  where access_token = p_token
  for update;

  if v_instance is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_instance.section_plan is null then
    return jsonb_build_object('ok', false, 'error', 'not_sectioned');
  end if;

  if p_session_id is null or p_session_id <> v_instance.session_id then
    return jsonb_build_object('ok', false, 'error', 'invalid_session_id');
  end if;

  if v_instance.status = 'submitted' then
    return jsonb_build_object(
      'ok', true,
      'is_last', true,
      'already_advanced', true,
      'status', 'submitted',
      'instance_id', v_instance.id,
      'exam_id', v_instance.exam_id,
      'session_id', v_instance.session_id,
      'section', null,
      'questions', '[]'::jsonb
    );
  end if;

  if v_instance.status <> 'in_progress' then
    return jsonb_build_object('ok', false, 'error', 'not_in_progress');
  end if;

  if p_from_index is null or p_from_index < 0 then
    return jsonb_build_object('ok', false, 'error', 'section_mismatch');
  end if;

  v_caught := exam_section_catch_up(v_instance.id);
  if v_caught->>'status' = 'submitted' then
    return jsonb_build_object(
      'ok', true,
      'is_last', true,
      'already_advanced', true,
      'status', 'submitted',
      'instance_id', v_instance.id,
      'exam_id', v_instance.exam_id,
      'session_id', v_instance.session_id,
      'section', null,
      'questions', '[]'::jsonb
    );
  end if;

  v_index := (v_caught->>'index')::integer;

  if p_from_index < v_index then
    v_section := exam_section_view(
      v_instance.section_plan,
      v_index,
      (v_caught->>'started_at')::timestamptz
    );
    v_questions := exam_section_questions(v_caught->'question_ids');
    return jsonb_build_object(
      'ok', true,
      'is_last', false,
      'already_advanced', true,
      'status', 'in_progress',
      'instance_id', v_instance.id,
      'exam_id', v_instance.exam_id,
      'session_id', v_instance.session_id,
      'expires_at', (v_caught->>'ends_at')::timestamptz,
      'section', v_section,
      'questions', v_questions
    );
  end if;

  if p_from_index > v_index then
    return jsonb_build_object('ok', false, 'error', 'section_mismatch');
  end if;

  v_next := null;
  select elem
  into v_next
  from jsonb_array_elements(v_instance.section_plan) elem
  where (elem->>'position')::integer = v_index + 1
  limit 1;

  if v_next is null then
    update test_instances
    set status = 'submitted',
        submitted_at = coalesce(submitted_at, now())
    where id = v_instance.id
      and status = 'in_progress';

    return jsonb_build_object(
      'ok', true,
      'is_last', true,
      'already_advanced', false,
      'status', 'submitted',
      'instance_id', v_instance.id,
      'exam_id', v_instance.exam_id,
      'session_id', v_instance.session_id,
      'section', null,
      'questions', '[]'::jsonb
    );
  end if;

  v_started := now();
  v_duration := (v_next->>'duration_minutes')::integer;
  v_ends := v_started + make_interval(mins => v_duration);

  update test_instances
  set current_section_index = v_index + 1,
      section_started_at = v_started,
      expires_at = v_ends
  where id = v_instance.id;

  v_section := exam_section_view(v_instance.section_plan, v_index + 1, v_started);
  v_questions := exam_section_questions(v_next->'question_ids');

  return jsonb_build_object(
    'ok', true,
    'is_last', false,
    'already_advanced', false,
    'status', 'in_progress',
    'instance_id', v_instance.id,
    'exam_id', v_instance.exam_id,
    'session_id', v_instance.session_id,
    'expires_at', v_ends,
    'section', v_section,
    'questions', v_questions
  );
end;
$$;

revoke execute on function public.exam_sections_block_delete() from public;
revoke execute on function public.exam_sections_block_delete() from anon;
revoke execute on function public.exam_sections_block_delete() from authenticated;

revoke execute on function public.exam_section_questions(jsonb) from public;
revoke execute on function public.exam_section_questions(jsonb) from anon;
revoke execute on function public.exam_section_questions(jsonb) from authenticated;

revoke execute on function public.exam_section_view(jsonb, integer, timestamptz) from public;
revoke execute on function public.exam_section_view(jsonb, integer, timestamptz) from anon;
revoke execute on function public.exam_section_view(jsonb, integer, timestamptz) from authenticated;

revoke execute on function public.exam_section_catch_up(uuid) from public;
revoke execute on function public.exam_section_catch_up(uuid) from anon;
revoke execute on function public.exam_section_catch_up(uuid) from authenticated;

-- Student RPCs are security definer and call these helpers as their owner.
-- Revoke from PUBLIC also drops the owner's default EXECUTE when the owner
-- is not a superuser. Grant it back to the migration role, which owns them.
grant execute on function public.exam_section_questions(jsonb) to current_user;
grant execute on function public.exam_section_view(jsonb, integer, timestamptz) to current_user;
grant execute on function public.exam_section_catch_up(uuid) to current_user;

revoke execute on function start_session(text, text) from public;
revoke execute on function start_session(text, text) from authenticated;
grant execute on function start_session(text, text) to anon;

revoke execute on function submit_answer(text, text, uuid, text) from public;
revoke execute on function submit_answer(text, text, uuid, text) from authenticated;
grant execute on function submit_answer(text, text, uuid, text) to anon;

revoke execute on function advance_section(text, text, integer) from public;
revoke execute on function advance_section(text, text, integer) from authenticated;
grant execute on function advance_section(text, text, integer) to anon;
