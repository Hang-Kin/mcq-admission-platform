-- migration_012_question_images.sql
-- Proposed. Do not apply until reviewed.
--
-- Image delivery: public-read bucket, staff-only writes.
-- The student session calls start_session as anon and then renders
-- image_url in the browser. Signing URLs inside that SQL function would
-- need a storage signing key in the database. Question text is already
-- returned to anon by the same function, so a public object URL is the
-- same sensitivity, as long as the path is unguessable (a random UUID,
-- chosen by the app on upload) and writes stay staff-only.
-- Public bucket URLs are served by Storage without a SELECT policy.
-- There is intentionally no SELECT/INSERT/UPDATE/DELETE policy for anon.
--
-- FLAG: start_session below is the migration_009 function with one added
-- key in the per-question jsonb_build_object: 'image_url', q.image_url.
-- Timeslot resolution, question assignment, and expiry logic are unchanged.

alter table public.questions
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-images',
  'question-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "question_images_staff_insert" on storage.objects;
create policy "question_images_staff_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'question-images'
  and public.is_staff()
);

drop policy if exists "question_images_staff_update" on storage.objects;
create policy "question_images_staff_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'question-images' and public.is_staff())
with check (bucket_id = 'question-images' and public.is_staff());

drop policy if exists "question_images_staff_delete" on storage.objects;
create policy "question_images_staff_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'question-images' and public.is_staff());

-- FLAG: additive start_session change only. See header comment.
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
        'question_set', q.question_set,
        'image_url', q.image_url
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
