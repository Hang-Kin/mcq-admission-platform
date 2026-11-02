-- migration_026_teacher_marking.sql
-- Proposed. Do not apply until reviewed.
--
-- HIGH RISK
-- * New tables, RLS policies, and grants. Staff only.
-- * Security definer functions update public.responses (is_correct,
--   needs_review, reviewed_at, reviewed_by). They do not replace
--   submit_answer. They do not read or grant questions.correct_answer.
-- * Revokes below are on these new tables and new functions only.
--   No existing anon grant is changed. Anon is not granted anything here.
-- * No DELETE of existing rows except response_marks rows whose state is
--   'confirmed' when a regrade changes that response. Overridden rows are
--   never updated and never deleted.
-- * Does not touch proxy.ts, .env, or auth.
--
-- Not applied.
--
-- Storage
-- * response_marks: one row per response once a teacher confirms or overrides.
--   No row means Unconfirmed.
--   system_is_correct is the system mark at the time of the teacher action.
--   system_mark_known is false only for older manual rows whose original
--   system mark was already overwritten before this table existed.
--   override_is_correct is set only for Overridden.
-- * regrade_log: one row per regrade (who, when, question, old answer,
--   new answer, how many stored marks changed, how many overrides were kept).
--
-- Scores keep using responses.is_correct until a teacher overrides.
-- An override does not change responses.is_correct, so the system judgement
-- stays visible. Regrade updates responses.is_correct only for rows that
-- are not overridden, and it drops a confirmation when that stored mark
-- actually changes. Overridden rows are left untouched.

begin;

alter table public.responses
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

create table if not exists public.response_marks (
  response_id uuid primary key references public.responses (id) on delete cascade,
  state text not null check (state in ('confirmed', 'overridden')),
  system_is_correct boolean,
  system_mark_known boolean not null default true,
  override_is_correct boolean,
  note text,
  marked_by uuid,
  marked_by_label text,
  marked_at timestamptz not null default now(),
  constraint response_marks_override_check check (
    (state = 'confirmed' and override_is_correct is null)
    or (state = 'overridden' and override_is_correct is not null)
  )
);

create table if not exists public.regrade_log (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id),
  old_answer text,
  new_answer text,
  changed_count integer not null check (changed_count >= 0),
  preserved_override_count integer not null default 0 check (preserved_override_count >= 0),
  actor_id uuid,
  actor_label text,
  created_at timestamptz not null default now()
);

alter table public.response_marks enable row level security;
alter table public.regrade_log enable row level security;

drop policy if exists "response_marks_select_staff" on public.response_marks;
create policy "response_marks_select_staff" on public.response_marks
  for select to authenticated
  using (public.is_staff());

drop policy if exists "response_marks_insert_staff" on public.response_marks;
create policy "response_marks_insert_staff" on public.response_marks
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists "response_marks_update_staff" on public.response_marks;
create policy "response_marks_update_staff" on public.response_marks
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "response_marks_delete_staff" on public.response_marks;
create policy "response_marks_delete_staff" on public.response_marks
  for delete to authenticated
  using (public.is_staff());

drop policy if exists "regrade_log_select_staff" on public.regrade_log;
create policy "regrade_log_select_staff" on public.regrade_log
  for select to authenticated
  using (public.is_staff());

drop policy if exists "regrade_log_insert_staff" on public.regrade_log;
create policy "regrade_log_insert_staff" on public.regrade_log
  for insert to authenticated
  with check (public.is_staff());

revoke all on table public.response_marks from public;
revoke all on table public.response_marks from anon;
grant select on table public.response_marks to authenticated;

revoke all on table public.regrade_log from public;
revoke all on table public.regrade_log from anon;
grant select on table public.regrade_log to authenticated;

-- Older manual marks overwrote responses.is_correct and did not keep the
-- system mark. Treat those rows as overrides so a later regrade cannot
-- change them. system_mark_known stays false.
insert into public.response_marks (
  response_id,
  state,
  system_is_correct,
  system_mark_known,
  override_is_correct,
  note,
  marked_by,
  marked_by_label,
  marked_at
)
select
  resp.id,
  'overridden',
  null,
  false,
  resp.is_correct,
  null,
  resp.reviewed_by,
  null,
  coalesce(resp.reviewed_at, now())
from public.responses resp
where resp.graded_by = 'manual'
  and resp.is_correct is not null
on conflict (response_id) do nothing;

create or replace function public.teacher_confirm_response(p_response_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_correct boolean;
  v_label text;
begin
  if coalesce(public.is_staff(), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_staff');
  end if;

  select is_correct
  into v_is_correct
  from public.responses
  where id = p_response_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_label := coalesce(auth.jwt() ->> 'email', 'teacher');

  insert into public.response_marks (
    response_id,
    state,
    system_is_correct,
    system_mark_known,
    override_is_correct,
    note,
    marked_by,
    marked_by_label,
    marked_at
  )
  values (
    p_response_id,
    'confirmed',
    v_is_correct,
    true,
    null,
    null,
    auth.uid(),
    v_label,
    now()
  )
  on conflict (response_id) do update set
    state = 'confirmed',
    system_is_correct = excluded.system_is_correct,
    system_mark_known = true,
    override_is_correct = null,
    note = null,
    marked_by = excluded.marked_by,
    marked_by_label = excluded.marked_by_label,
    marked_at = now();

  update public.responses
  set needs_review = false,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_response_id;

  return jsonb_build_object('ok', true, 'confirmed', 1, 'changed', 0, 'preserved', 0);
end;
$$;

create or replace function public.teacher_override_response(
  p_response_id uuid,
  p_is_correct boolean,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_correct boolean;
  v_label text;
  v_note text;
begin
  if coalesce(public.is_staff(), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_staff');
  end if;

  if p_is_correct is null then
    return jsonb_build_object('ok', false, 'error', 'bad_verdict');
  end if;

  select is_correct
  into v_is_correct
  from public.responses
  where id = p_response_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_label := coalesce(auth.jwt() ->> 'email', 'teacher');
  v_note := nullif(left(btrim(coalesce(p_note, '')), 500), '');

  insert into public.response_marks (
    response_id,
    state,
    system_is_correct,
    system_mark_known,
    override_is_correct,
    note,
    marked_by,
    marked_by_label,
    marked_at
  )
  values (
    p_response_id,
    'overridden',
    v_is_correct,
    true,
    p_is_correct,
    v_note,
    auth.uid(),
    v_label,
    now()
  )
  on conflict (response_id) do update set
    state = 'overridden',
    system_is_correct = case
      when response_marks.system_mark_known = false then response_marks.system_is_correct
      else excluded.system_is_correct
    end,
    system_mark_known = response_marks.system_mark_known,
    override_is_correct = excluded.override_is_correct,
    note = excluded.note,
    marked_by = excluded.marked_by,
    marked_by_label = excluded.marked_by_label,
    marked_at = now();

  update public.responses
  set needs_review = false,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_response_id;

  return jsonb_build_object('ok', true, 'confirmed', 0, 'changed', 1, 'preserved', 0);
end;
$$;

create or replace function public.teacher_confirm_all(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
  v_label text;
begin
  if coalesce(public.is_staff(), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_staff');
  end if;

  if not exists (select 1 from public.test_instances where id = p_instance_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_label := coalesce(auth.jwt() ->> 'email', 'teacher');

  for v_row in
    select resp.id, resp.is_correct
    from public.responses resp
    where resp.test_instance_id = p_instance_id
      and not exists (
        select 1
        from public.response_marks marks
        where marks.response_id = resp.id
      )
    for update of resp
  loop
    insert into public.response_marks (
      response_id,
      state,
      system_is_correct,
      system_mark_known,
      override_is_correct,
      note,
      marked_by,
      marked_by_label,
      marked_at
    )
    values (
      v_row.id,
      'confirmed',
      v_row.is_correct,
      true,
      null,
      null,
      auth.uid(),
      v_label,
      now()
    );

    update public.responses
    set needs_review = false,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'confirmed', v_count, 'changed', 0, 'preserved', 0);
end;
$$;

-- Applies the list computed by the app (app/admin/results/regrade.ts).
-- Refuses every overridden row. Does not invent a new mark of its own.
create or replace function public.apply_question_regrade(
  p_question_id uuid,
  p_old_answer text,
  p_new_answer text,
  p_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored text;
  v_item jsonb;
  v_id uuid;
  v_raw jsonb;
  v_mark boolean;
  v_state text;
  v_current boolean;
  v_changed integer := 0;
  v_preserved integer := 0;
  v_label text;
  v_elem record;
begin
  if coalesce(public.is_staff(), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_staff');
  end if;

  select correct_answer
  into v_stored
  from public.questions
  where id = p_question_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_stored is distinct from p_new_answer then
    return jsonb_build_object('ok', false, 'error', 'mismatch');
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) > 5000 then
    return jsonb_build_object('ok', false, 'error', 'bad_verdict');
  end if;

  v_label := coalesce(auth.jwt() ->> 'email', 'teacher');

  for v_elem in
    select value from jsonb_array_elements(p_updates)
  loop
    v_item := v_elem.value;
    begin
      v_id := (v_item ->> 'id')::uuid;
    exception
      when others then
        continue;
    end;

    v_raw := v_item -> 'is_correct';
    if v_raw is null or v_raw = 'null'::jsonb then
      v_mark := null;
    elsif v_raw = 'true'::jsonb then
      v_mark := true;
    elsif v_raw = 'false'::jsonb then
      v_mark := false;
    else
      continue;
    end if;

    select is_correct
    into v_current
    from public.responses
    where id = v_id
      and question_id = p_question_id
    for update;

    if not found then
      continue;
    end if;

    v_state := null;
    select state
    into v_state
    from public.response_marks
    where response_id = v_id;

    if v_state = 'overridden' then
      continue;
    end if;

    if v_current is distinct from v_mark then
      update public.responses
      set is_correct = v_mark
      where id = v_id;

      delete from public.response_marks
      where response_id = v_id
        and state = 'confirmed';

      v_changed := v_changed + 1;
    end if;
  end loop;

  select count(*)
  into v_preserved
  from public.responses resp
  join public.response_marks marks on marks.response_id = resp.id
  where resp.question_id = p_question_id
    and marks.state = 'overridden';

  insert into public.regrade_log (
    question_id,
    old_answer,
    new_answer,
    changed_count,
    preserved_override_count,
    actor_id,
    actor_label
  )
  values (
    p_question_id,
    p_old_answer,
    p_new_answer,
    v_changed,
    v_preserved,
    auth.uid(),
    v_label
  );

  return jsonb_build_object(
    'ok', true,
    'confirmed', 0,
    'changed', v_changed,
    'preserved', v_preserved
  );
end;
$$;

revoke all on function public.teacher_confirm_response(uuid) from public;
revoke all on function public.teacher_confirm_response(uuid) from anon;
grant execute on function public.teacher_confirm_response(uuid) to authenticated;

revoke all on function public.teacher_override_response(uuid, boolean, text) from public;
revoke all on function public.teacher_override_response(uuid, boolean, text) from anon;
grant execute on function public.teacher_override_response(uuid, boolean, text) to authenticated;

revoke all on function public.teacher_confirm_all(uuid) from public;
revoke all on function public.teacher_confirm_all(uuid) from anon;
grant execute on function public.teacher_confirm_all(uuid) to authenticated;

revoke all on function public.apply_question_regrade(uuid, text, text, jsonb) from public;
revoke all on function public.apply_question_regrade(uuid, text, text, jsonb) from anon;
grant execute on function public.apply_question_regrade(uuid, text, text, jsonb) to authenticated;

commit;
