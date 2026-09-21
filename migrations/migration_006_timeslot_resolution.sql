-- migration_006_timeslot_resolution.sql
-- Proposed. Do not apply until reviewed. Schema + RPC changes need explicit
-- sign-off (same rule as migration_005).
--
-- What: timeslot-aware first-scan resolution inside start_session.
--   - New public.timeslots table (staff RLS only; no anon table grants).
--   - exams.active_timeslot_override, test_instances.timeslot_id.
--   - start_session keeps the same signature (p_token text, p_session_id text).
--
-- Why a full CREATE OR REPLACE of start_session:
--   The live function body lives in the database (originally
--   migration_003_student_rpc.sql, which was never committed). This file
--   reconstructs the existing contract used by SessionExam.tsx and adds
--   first-scan timeslot logic on the started_at IS NULL branch only.
--   Diff against pg_get_functiondef('start_session'::regproc) before apply.
--
-- First-scan (started_at IS NULL) only:
--   1. If the exam has zero timeslots: keep existing assigned_question_ids
--      when already populated (Sample Admission Test / generate-instance
--      draw). If empty, draw from question_set = 'General'. Never set
--      timeslot_id.
--   2. Else resolve timeslot_id:
--        a. exams.active_timeslot_override for this exam, if set (always wins).
--        b. Else among timeslots that have not finished (ends_at > now()),
--           pick the earliest starts_at. This is the current window, or the
--           next window when a student is late (after A.ends_at and before
--           B.starts_at). Using only "latest starts_at <= now()" would keep
--           assigning A in that gap.
--        c. Else (every timeslot has ended) pick the latest starts_at.
--   3. Draw assigned_question_ids from questions for that timeslot's
--      question_set. Selection matches generate-instance: random shuffle,
--      then the same count as the instance already had; if the instance had
--      no ids yet, take every question in the set.
--   4. expires_at := now() + exams.duration_minutes (timer starts at scan).
--   5. Store timeslot_id on the test_instances row.
--
-- Re-entry (started_at IS NOT NULL): do not re-resolve or redraw. Same
-- session_id / expiry / double-scan lock as today.

create table public.timeslots (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id),
  label text not null,
  question_set text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz default now(),
  unique (exam_id, label)
);

alter table public.exams
  add column active_timeslot_override uuid references public.timeslots(id);

alter table public.test_instances
  add column timeslot_id uuid references public.timeslots(id);

alter table public.timeslots enable row level security;

-- Drop anything rls_auto_enable may have attached (permissive/anon).
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'timeslots'
  loop
    execute format('drop policy if exists %I on public.timeslots', r.policyname);
  end loop;
end
$$;

create policy "timeslots_select_staff" on public.timeslots
  for select to authenticated using (is_staff());
create policy "timeslots_insert_staff" on public.timeslots
  for insert to authenticated with check (is_staff());
create policy "timeslots_update_staff" on public.timeslots
  for update to authenticated using (is_staff());
create policy "timeslots_delete_admin" on public.timeslots
  for delete to authenticated using (is_admin());

revoke all on table public.timeslots from public;
revoke all on table public.timeslots from anon;
grant select, insert, update, delete on table public.timeslots to authenticated;

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
  v_has_timeslots boolean;
  v_question_set text;
  v_timeslot_id uuid;
  v_assigned jsonb;
  v_draw_limit int;
  v_session_id text;
  v_questions jsonb;
  v_instance_id uuid;
  v_exam_id uuid;
  v_expires_at timestamptz;
  v_status text;
begin
  select id, exam_id, status, expires_at, assigned_question_ids,
         session_id, started_at, timeslot_id
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
      select 1 from timeslots where exam_id = v_exam.id
    ) into v_has_timeslots;

    v_timeslot := null;
    v_timeslot_id := null;
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
      v_draw_limit := case
        when jsonb_typeof(coalesce(v_assigned, '[]'::jsonb)) = 'array'
        then jsonb_array_length(v_assigned)
        else 0
      end;

      select coalesce(jsonb_agg(s.id), '[]'::jsonb)
      into v_assigned
      from (
        select id
        from questions
        where question_set = v_question_set
        order by random()
        limit case
          when v_draw_limit > 0 then v_draw_limit
          else 2147483647
        end
      ) s;
    end if;

    v_session_id := replace(gen_random_uuid()::text, '-', '');
    v_instance_id := v_instance.id;
    v_exam_id := v_exam.id;
    v_status := 'in_progress';
    v_expires_at := now() + make_interval(mins => v_exam.duration_minutes);

    update test_instances
    set
      started_at = now(),
      status = v_status,
      session_id = v_session_id,
      expires_at = v_expires_at,
      assigned_question_ids = v_assigned,
      timeslot_id = v_timeslot_id
    where id = v_instance_id;

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
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'type', q.type,
        'options', q.options,
        'category', q.category,
        'question_set', q.question_set
      )
      order by ord
    ),
    '[]'::jsonb
  )
  into v_questions
  from jsonb_array_elements_text(coalesce(v_assigned, '[]'::jsonb))
    with ordinality as t(question_id, ord)
  join questions q on q.id = t.question_id::uuid;

  return jsonb_build_object(
    'ok', true,
    'instance_id', v_instance_id,
    'exam_id', v_exam_id,
    'expires_at', v_expires_at,
    'status', v_status,
    'session_id', v_session_id,
    'questions', v_questions
  );
end;
$$;

revoke execute on function start_session(text, text) from public;
revoke execute on function start_session(text, text) from authenticated;
grant execute on function start_session(text, text) to anon;
