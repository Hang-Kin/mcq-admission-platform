-- migration_004_grading_tolerance.sql
-- What: documents a change to submit_answer() that was applied directly to the
-- live database (not through a tracked migration) at some point after
-- migration_003_student_rpc.sql. This file exists to make that change
-- reproducible — it is NOT a new change being introduced. It is a snapshot
-- of what is CURRENTLY LIVE in production, verified via
-- pg_get_functiondef(oid) on 2026-09-11.
--
-- Confirmed via live click-through testing (Test Student Three,
-- token bee481bce0bb4d94bc2f52b4283c307a):
--   - A wrong radio answer ("24" vs correct "32") correctly graded is_correct=false.
--   - A correct numeric answer ("6") correctly graded is_correct=true.
--   - A text answer ("erm name?") correctly graded is_correct=null,
--     graded_by='auto', needs_review=true.
--
-- What changed vs. migration_003_student_rpc.sql:
--   1. Grading is now case/whitespace-insensitive for non-numeric answers:
--      lower(trim(p_answer)) = lower(trim(correct_answer)), instead of an
--      exact string match. Applies to both 'radio' and 'text' types (text
--      still isn't truly auto-graded in a meaningful sense — see needs_review).
--   2. Numeric grading now tolerates a difference of up to 0.01, instead of
--      requiring exact numeric equality. Guards against float rounding and
--      trivial formatting differences ("6" vs "6.00").
--   3. graded_by is now ALWAYS 'auto' — it no longer varies by question type.
--      Whether a response needs a human is tracked by a SEPARATE column,
--      needs_review (boolean, default false on the responses table), rather
--      than by leaving graded_by null. needs_review = true whenever
--      question type = 'text'.
--   4. Requirement (explicit, per product decision 2026-09-11): every
--      open-ended/text-type answer MUST be flagged for manual review.
--      This is already true in the live function (needs_review := (type = 'text')).
--      This migration preserves that behavior exactly — do not remove it.
--
-- Known gap this migration does NOT close: there is currently no admin UI
-- that surfaces responses.needs_review = true for a human grader to act on.
-- The column and the flagging logic are correct and live; the review queue
-- screen itself has not been built. Track as a new backlog item.

create or replace function submit_answer(
  p_token text,
  p_session_id text,
  p_question_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_instance record;
  v_question record;
  v_is_correct boolean;
  v_needs_review boolean;
  v_assigned_ids text[];
begin
  select id, status, expires_at, assigned_question_ids, session_id
  into v_instance
  from test_instances
  where access_token = p_token;

  if v_instance is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if p_session_id is null or p_session_id <> v_instance.session_id then
    return jsonb_build_object('ok', false, 'error', 'invalid_session_id');
  end if;

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

revoke execute on function submit_answer(text, text, uuid, text) from authenticated;
grant execute on function submit_answer(text, text, uuid, text) to anon;
