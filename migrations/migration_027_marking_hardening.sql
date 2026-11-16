-- migration_027_marking_hardening.sql
-- UNAPPLIED. Do not apply until reviewed.
-- Depends on migration_026, which is already live. Do not re-apply 026.
--
-- HIGH RISK
-- * Replaces security definer functions teacher_confirm_response,
--   teacher_confirm_all, and apply_question_regrade.
-- * Revokes insert, update, and delete on response_marks and regrade_log
--   from authenticated. Select stays. Writes go through the functions.
-- * Drops the staff write policies on those two tables. The functions are
--   security definer, so they still write. A later grant cannot use the
--   old policies.
-- * Does not replace teacher_override_response, submit_answer, or
--   start_session. Does not read or grant questions.correct_answer to anon.
-- * Does not touch proxy.ts, .env, or auth.
-- * No DELETE of response rows. Confirmed response_marks rows are still
--   deleted only when a regrade changes that response. Overridden rows
--   are not updated and not deleted.
--
-- Not applied.

begin;

-- Ungraded answers (is_correct is null) must be marked by a person.
-- Confirm stores the system mark. It refuses a null mark.
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

  if v_is_correct is null then
    return jsonb_build_object('ok', false, 'error', 'ungraded');
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

-- Confirm every unmarked answer on the paper except null marks.
-- Those stay unmarked so a person can override them.
create or replace function public.teacher_confirm_all(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
  v_skipped integer := 0;
  v_label text;
begin
  if coalesce(public.is_staff(), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_staff');
  end if;

  if not exists (select 1 from public.test_instances where id = p_instance_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_label := coalesce(auth.jwt() ->> 'email', 'teacher');

  select count(*)
  into v_skipped
  from public.responses resp
  where resp.test_instance_id = p_instance_id
    and resp.is_correct is null
    and not exists (
      select 1
      from public.response_marks marks
      where marks.response_id = resp.id
    );

  for v_row in
    select resp.id, resp.is_correct
    from public.responses resp
    where resp.test_instance_id = p_instance_id
      and resp.is_correct is not null
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

  return jsonb_build_object(
    'ok', true,
    'confirmed', v_count,
    'changed', 0,
    'preserved', 0,
    'skipped', v_skipped
  );
end;
$$;

-- Recomputes each stored mark from questions.correct_answer and
-- responses.student_answer. Same comparison as submit_answer in
-- migration 019. p_updates is the list the app still sends. It is not
-- read. Overridden rows stay untouched.
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
  v_type text;
  v_stored text;
  v_answer text;
  v_mark boolean;
  v_changed integer := 0;
  v_preserved integer := 0;
  v_label text;
  v_row record;
begin
  if coalesce(public.is_staff(), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_staff');
  end if;

  -- Signature stays (uuid, text, text, jsonb). The payload is ignored.
  if p_updates is null then
    null;
  end if;

  select q.type, q.correct_answer
  into v_type, v_stored
  from public.questions q
  where q.id = p_question_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_stored is distinct from p_new_answer then
    return jsonb_build_object('ok', false, 'error', 'mismatch');
  end if;

  v_label := coalesce(auth.jwt() ->> 'email', 'teacher');

  for v_row in
    select resp.id, resp.student_answer, resp.is_correct, marks.state as mark_state
    from public.responses resp
    left join public.response_marks marks on marks.response_id = resp.id
    where resp.question_id = p_question_id
    for update of resp
  loop
    if v_row.mark_state = 'overridden' then
      continue;
    end if;

    v_answer := v_row.student_answer;

    if v_type = 'fraction' then
      v_mark := trim(coalesce(v_answer, '')) = trim(coalesce(v_stored, ''));
    elsif v_type = 'numeric' then
      begin
        v_mark := v_answer::numeric = v_stored::numeric;
      exception
        when others then
          v_mark := false;
      end;
    else
      v_mark := lower(trim(v_answer)) = lower(trim(v_stored));
    end if;

    if v_row.is_correct is distinct from v_mark then
      update public.responses
      set is_correct = v_mark
      where id = v_row.id;

      delete from public.response_marks
      where response_id = v_row.id
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

revoke all on function public.teacher_confirm_all(uuid) from public;
revoke all on function public.teacher_confirm_all(uuid) from anon;
grant execute on function public.teacher_confirm_all(uuid) to authenticated;

revoke all on function public.apply_question_regrade(uuid, text, text, jsonb) from public;
revoke all on function public.apply_question_regrade(uuid, text, text, jsonb) from anon;
grant execute on function public.apply_question_regrade(uuid, text, text, jsonb) to authenticated;

revoke all on table public.response_marks from public;
revoke all on table public.response_marks from anon;
revoke insert, update, delete on table public.response_marks from authenticated;
grant select on table public.response_marks to authenticated;

revoke all on table public.regrade_log from public;
revoke all on table public.regrade_log from anon;
revoke insert, update, delete on table public.regrade_log from authenticated;
grant select on table public.regrade_log to authenticated;

drop policy if exists "response_marks_insert_staff" on public.response_marks;
drop policy if exists "response_marks_update_staff" on public.response_marks;
drop policy if exists "response_marks_delete_staff" on public.response_marks;
drop policy if exists "regrade_log_insert_staff" on public.regrade_log;

commit;

-- Rollback (do not run as part of this file):
-- 1. Replace teacher_confirm_response, teacher_confirm_all, and
--    apply_question_regrade with the bodies in
--    migrations/migration_026_teacher_marking.sql. Do not re-run 026.
-- 2. Then run only:
--    grant insert, update, delete on table public.response_marks to authenticated;
--    grant insert, update, delete on table public.regrade_log to authenticated;
--    create policy "response_marks_insert_staff" on public.response_marks
--      for insert to authenticated with check (public.is_staff());
--    create policy "response_marks_update_staff" on public.response_marks
--      for update to authenticated using (public.is_staff()) with check (public.is_staff());
--    create policy "response_marks_delete_staff" on public.response_marks
--      for delete to authenticated using (public.is_staff());
--    create policy "regrade_log_insert_staff" on public.regrade_log
--      for insert to authenticated with check (public.is_staff());
