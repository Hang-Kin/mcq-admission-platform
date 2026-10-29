-- migration_022_student_intake.sql
-- Proposed. Do not apply until reviewed.
-- Depends on public.students from supabase_schema.sql. No earlier migration
-- changes application_number.
--
-- HIGH RISK
-- * Adds students.intake (text, not null). Every existing row is set to
--   2026-10. The app shows that value as "2026 October Entry". There is
--   no column default after this migration, so a new insert must set intake.
-- * Drops the global unique constraint students_application_number_key.
--   That is the PostgreSQL name for the inline UNIQUE on application_number
--   in supabase_schema.sql.
-- * Adds unique (intake, application_number). The same four-digit code may
--   exist in two intakes. It may not exist twice in one intake.
-- * Rejects application_number values that are not exactly four digits.
--   If any existing row fails that check, this whole migration rolls back.
--   No application number is rewritten.
-- * name is unchanged. It stores the full English name.
-- * Does not change RLS policies or grants. Does not DELETE rows.
-- * Does not touch proxy.ts, .env, auth, or any other migration.
--
-- 2026-10 is the confirmed label for existing test rows. Do not substitute
-- another value.

begin;

alter table public.students
  add column intake text;

update public.students
  set intake = '2026-10'
  where intake is null;

alter table public.students
  alter column intake set not null;

alter table public.students
  add constraint students_intake_yyyymm
  check (intake ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.students
  drop constraint students_application_number_key;

alter table public.students
  add constraint students_intake_application_number_key
  unique (intake, application_number);

alter table public.students
  add constraint students_application_number_four_digits
  check (application_number ~ '^[0-9]{4}$');

commit;
