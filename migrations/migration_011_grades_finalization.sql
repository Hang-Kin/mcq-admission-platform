-- migration_011_grades_finalization.sql
-- Proposed. Do not apply until reviewed.
--
-- 1. Review audit columns on responses. This supersedes the never-applied
--    migration_005_review_audit.sql (same columns, renumbered). Apply this
--    before deploying the grades UI: the correction actions (grades detail
--    page and review queue) write reviewed_at / reviewed_by.
-- 2. One grades row per student per exam, so re-finalizing upserts instead
--    of inserting a duplicate. grades has zero rows today, so this cannot
--    fail on existing data.
--
-- No RLS or grant changes: grades_insert_admin / grades_update_admin and
-- responses_update_admin already cover the admin-only writes.

alter table public.responses
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.grades'::regclass
      and conname = 'grades_student_exam_key'
  ) then
    alter table public.grades
      add constraint grades_student_exam_key unique (student_id, exam_id);
  end if;
end
$$;
