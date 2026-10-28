-- migration_020_question_subject.sql
-- Proposed. Do not apply until reviewed.
-- Depends on migration_013 (exam_section_questions) and migration_017
-- (questions.subject). Migrations 016 through 021 call the function and
-- do not replace it.
--
-- HIGH RISK
-- * Replaces exam_section_questions. It stays SECURITY DEFINER and STABLE.
--   Grants are unchanged: public, anon, and authenticated may not execute
--   it; the migration role (current_user) may.
-- * No other function is replaced. No table, policy, or grant on any other
--   object is changed. No DELETE, DROP, or data change.
-- * questions.question_text is returned as stored. This file does not
--   rewrite it.
-- * Does not touch proxy.ts, .env, API routes, or auth.
--
-- The only change from the migration_013 exam_section_questions body
-- * Each returned question object also includes 'subject', q.subject.
-- * id, question_text, type, options, category, question_set, and
--   image_url are unchanged. correct_answer stays omitted.

-- ---------------------------------------------------------------------------
-- exam_section_questions
-- Same body as migration_013, plus subject.
-- ---------------------------------------------------------------------------

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
        'subject', q.subject,
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

revoke execute on function public.exam_section_questions(jsonb) from public;
revoke execute on function public.exam_section_questions(jsonb) from anon;
revoke execute on function public.exam_section_questions(jsonb) from authenticated;

-- Student RPCs are security definer and call this helper as their owner.
-- Revoke from PUBLIC also drops the owner's default EXECUTE when the owner
-- is not a superuser. Grant it back to the migration role, which owns it.
grant execute on function public.exam_section_questions(jsonb) to current_user;
