# ADR: Release a stuck exam session

Status: Proposed. Not implemented. No SQL in this change is applied.

## Problem

A student exam is locked to one `test_instances.session_id`. The browser
stores that id under `mcq-session:<token>` and sends it back to
`start_session`, so a reload on the same device continues.

If that device dies, the id is gone with it. The next open sends
`p_session_id` null. Live `start_session` (migration_025) then returns
`session_already_active`, and the student cannot continue. Staff need a
way to drop that device lock without deleting answers or changing the
end time.

## Decision

Add a **Release session** button later, on the sitting page
(`/admin/schedule`, codes list, one row per student in
`QrGeneratorClient`). Show it only when that student's instance status
is `in_progress`. Do not add it in the resume change. Do not put it on
the student exam screen.

The button calls a new staff-only RPC. It does not clear every student
on the sitting. It clears one instance.

Setting `session_id` to null is not enough on its own. Live
`start_session` treats a null `p_session_id` as another device whenever
`started_at` is already set:

```sql
if p_session_id is null or p_session_id <> v_instance.session_id then
  return jsonb_build_object('ok', false, 'error', 'session_already_active');
end if;
```

After a release, the next `start_session` for that token must mint a new
`session_id` and keep the sitting. Both the sectioned branch and the
flat branch need that path.

## SQL this button needs

Unapplied. Not in `migrations/` until a later reviewed file. HIGH RISK:
it replaces `start_session` and adds a security-definer RPC. It must not
return `correct_answer`, `is_correct`, or `access_token`. It must not
grant execute to `anon`.

```sql
-- Staff only. One instance. Keeps answers, expiry, questions, and section progress.
create or replace function public.release_exam_session(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if coalesce(public.is_staff(), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_staff');
  end if;

  select status
  into v_status
  from test_instances
  where id = p_instance_id
  for update;

  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_status = 'submitted' then
    return jsonb_build_object('ok', false, 'error', 'already_submitted');
  end if;

  update test_instances
  set session_id = null
  where id = p_instance_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.release_exam_session(uuid) from public;
revoke all on function public.release_exam_session(uuid) from anon;
revoke all on function public.release_exam_session(uuid) from authenticated;
grant execute on function public.release_exam_session(uuid) to authenticated;
```

`public.is_staff()` is the live helper (`profiles.role in ('admin', 'teacher')`).
The function takes the instance id staff already load. It does not take
the student's access token.

Inside the already-started branch of `start_session`, before the
`session_already_active` check, both when `section_plan` is set and when
it is not:

```sql
if v_instance.session_id is null then
  v_session_id := replace(gen_random_uuid()::text, '-', '');
  update test_instances
  set session_id = v_session_id
  where id = v_instance.id;
elsif p_session_id is null or p_session_id <> v_instance.session_id then
  return jsonb_build_object('ok', false, 'error', 'session_already_active');
else
  v_session_id := v_instance.session_id;
end if;
```

That re-bind must not change `started_at`, `expires_at`,
`assigned_question_ids`, `section_plan`, `current_section_index`,
`section_started_at`, `status`, or any `responses` row. The countdown
still comes from the server end time. The success payload stays the one
in migration_030 once that file is applied: questions without the answer
key, plus `saved_answers` for this instance only.

## What stays locked

A second device that still has the old id, or that sends null while a
new id is stored, still gets `session_already_active`. Release does not
turn the link into a shared session.

## Rollback

Drop is the wrong tool if a later `start_session` still calls the
function. Rollback is: restore the previous `start_session` body, then
`drop function public.release_exam_session(uuid);`. No table change, so
there is no data to restore. Rows left with a null `session_id` start
again under the restored function only if that body still rejects a null
id; staff would re-open those by the old lock until a new release path
exists. Prefer restoring both functions together.
