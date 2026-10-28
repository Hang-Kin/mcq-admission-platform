-- migration_019_exact_numeric.sql
-- Proposed. Do not apply until reviewed.
-- Depends on migration_017 (the current submit_answer, including fraction
-- grading). migration_018 does not replace submit_answer.
--
-- HIGH RISK
-- * Replaces submit_answer. It stays SECURITY DEFINER. Grants are unchanged:
--   anon may execute it; public and authenticated may not.
-- * No other function is replaced. No table, policy, or grant on any other
--   object is changed. No DELETE, DROP, or data change.
-- * Does not touch proxy.ts, .env, API routes, or auth.
--
-- The only change from the migration_017 submit_answer body
-- * The numeric branch is exact numeric equality:
--     p_answer::numeric = correct_answer::numeric
--   written in this function as
--     p_answer::numeric = v_question.correct_answer::numeric
-- * 5 and 5.0 both match a stored 5.
-- * 0.94 does not match 0.93. The 0.01 tolerance is removed.
-- * The fraction branch is unchanged: exact text, so 2/6 is not 1/3.
-- * Radio case-folding and the text-answer review flag are unchanged.

-- ---------------------------------------------------------------------------
-- submit_answer
-- Same body as migration_017, except the numeric branch below.
-- Numeric equality: p_answer::numeric = correct_answer::numeric.
-- 5 and 5.0 both match 5. 0.94 does not match 0.93.
-- 2/6 is a normal wrong answer when the stored answer is 1/3.
-- b = 0 and non-integers are refused and not stored.
-- advance_section is not replaced. It already reads question_ids by id.
-- ---------------------------------------------------------------------------

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
  v_fraction text;
  v_num integer;
  v_den integer;
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

  if v_question.type = 'fraction' then
    v_fraction := trim(coalesce(p_answer, ''));
    if v_fraction !~ '^-?(0|[1-9][0-9]*)/[0-9]+$'
       or v_fraction ~ '^-0/' then
      return jsonb_build_object('ok', false, 'error', 'invalid_fraction');
    end if;
    begin
      v_num := split_part(v_fraction, '/', 1)::integer;
      v_den := split_part(v_fraction, '/', 2)::integer;
    exception
      when others then
        return jsonb_build_object('ok', false, 'error', 'invalid_fraction');
    end;
    if v_num is null or v_den is null or v_den = 0 then
      return jsonb_build_object('ok', false, 'error', 'invalid_fraction');
    end if;
    -- Exact text. Do not reduce 2/6 to 1/3.
    v_is_correct := v_fraction = trim(coalesce(v_question.correct_answer, ''));
  elsif v_question.type = 'numeric' then
    begin
      v_is_correct := p_answer::numeric = v_question.correct_answer::numeric;
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

revoke execute on function submit_answer(text, text, uuid, text) from public;
revoke execute on function submit_answer(text, text, uuid, text) from authenticated;
grant execute on function submit_answer(text, text, uuid, text) to anon;
