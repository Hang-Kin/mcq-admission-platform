-- migration_031_teacher_question_delete_and_policy_cleanup.sql
-- HIGH RISK. Applied on staging only. Do not apply to live until reviewed.
--
-- Documents the exact staging policy state for questions, exams, and
-- profiles after teachers were allowed to delete questions (Option B).
-- Idempotent: drop policy if exists, then create. One transaction.
--
-- Do not run this file from a cloud agent or against live. Staging already
-- has it. Never touch https://dzdd. Staging host must start with
-- https://zdprf after trim.
--
-- Target policies (must match staging exactly):
-- public.questions (all TO authenticated)
--   questions_select_staff  SELECT USING is_staff()
--   questions_insert_staff  INSERT WITH CHECK is_staff()
--   questions_update_staff  UPDATE USING is_staff()
--   questions_delete_staff  DELETE USING is_staff()
--   Drop any other policy on questions, including questions_delete_admin
--   and questions_select_merged (and the old public read).
-- public.exams (all TO authenticated)
--   exams_select_staff   SELECT USING is_staff()
--   exams_insert_merged  INSERT WITH CHECK (is_admin() OR is_staff())
--   exams_update_merged  UPDATE USING and WITH CHECK (is_admin() OR is_staff())
--   exams_delete_admin   DELETE USING is_admin()
-- public.profiles
--   profiles_select_merged SELECT TO authenticated
--     USING (is_admin() OR (id = (select auth.uid())))
--
-- Depends on is_staff() / is_admin() from the live role helpers. Does not
-- edit 004, 025, 027, 028, 029, or 030. Does not change grants, functions,
-- proxy.ts, .env, or auth.

begin;

-- questions: drop every existing policy, then recreate the staff set.
do $$
declare
  r record;
begin
  for r in
    select pol.polname
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'questions'
  loop
    execute format('drop policy if exists %I on public.questions', r.polname);
  end loop;
end;
$$;

create policy questions_select_staff on public.questions
  for select to authenticated
  using (is_staff());

create policy questions_insert_staff on public.questions
  for insert to authenticated
  with check (is_staff());

create policy questions_update_staff on public.questions
  for update to authenticated
  using (is_staff());

create policy questions_delete_staff on public.questions
  for delete to authenticated
  using (is_staff());

-- exams: drop named policies we replace, then recreate the staging set.
drop policy if exists exams_select_staff on public.exams;
drop policy if exists exams_insert_admin on public.exams;
drop policy if exists exams_insert_staff on public.exams;
drop policy if exists exams_insert_merged on public.exams;
drop policy if exists exams_update_admin on public.exams;
drop policy if exists exams_update_staff_override on public.exams;
drop policy if exists exams_update_merged on public.exams;
drop policy if exists exams_delete_admin on public.exams;

create policy exams_select_staff on public.exams
  for select to authenticated
  using (is_staff());

create policy exams_insert_merged on public.exams
  for insert to authenticated
  with check (is_admin() or is_staff());

create policy exams_update_merged on public.exams
  for update to authenticated
  using (is_admin() or is_staff())
  with check (is_admin() or is_staff());

create policy exams_delete_admin on public.exams
  for delete to authenticated
  using (is_admin());

-- profiles: drop select policies we replace, then recreate merged.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_select_merged on public.profiles;

create policy profiles_select_merged on public.profiles
  for select to authenticated
  using (is_admin() or (id = (select auth.uid())));

commit;

-- Rollback (do not run as part of this file):
-- drop policy if exists questions_delete_staff on public.questions;
-- create policy questions_delete_admin on public.questions
--   for delete to authenticated
--   using (is_admin());
-- Recreate any other questions / exams / profiles policy this file dropped
-- from the live before-state (rls_setup + role note + 007/008/009/015, or
-- from 029 after-state if 029 was applied first). Do not re-apply 004, 025,
-- or 028.
