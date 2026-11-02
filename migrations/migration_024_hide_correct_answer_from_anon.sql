-- migration_024_hide_correct_answer_from_anon.sql
-- Proposed. Do not apply until reviewed.
-- Depends on public.questions from supabase_schema.sql. Later columns
-- (question_set, image_url, subject, and any other column already on the
-- table) are granted to anon only when they exist. correct_answer is not.
--
-- HIGH RISK
-- * Changes grants. Does not change RLS policies, so the existing
--   "Allow public read on questions" policy stays.
-- * Revokes SELECT on public.questions from PUBLIC and from anon.
-- * Grants SELECT on every questions column except correct_answer back to
--   anon. A student using the anonymous key cannot read correct_answer.
--   select * from anon fails, because that list includes correct_answer.
--   The student exam does not read this table. It uses start_session, which
--   is security definer and already omits correct_answer.
-- * Grants table SELECT back to authenticated, so a signed-in admin or
--   teacher can still read correct_answer on the review screens. This
--   matters if their only previous grant came through PUBLIC.
-- * Grants table SELECT to service_role when that role exists.
-- * Does not revoke anything from authenticated. Does not replace
--   exam_section_questions, start_session, or submit_answer.
-- * No DELETE, DROP, or data change. No new policy.
-- * Does not touch proxy.ts, .env, or auth.
--
-- Not applied. Staff review keeps working before and after this file runs.

begin;

revoke select on table public.questions from public;
revoke select on table public.questions from anon;

grant select on table public.questions to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on table public.questions to service_role;
  end if;
end
$$;

do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'questions'
    and column_name <> 'correct_answer';

  if v_cols is null then
    raise exception 'public.questions was not found';
  end if;

  execute format('grant select (%s) on table public.questions to anon', v_cols);
end
$$;

commit;
