-- migration_022_student_intake.sql
-- Proposed. Do not apply until reviewed.
-- Depends on public.students from supabase_schema.sql. No earlier migration
-- changes application_number.
--
-- HIGH RISK
-- * Adds students.intake (text, not null). Every existing row is set to
--   2026-10. The app shows that value as "2026 October Entry". There is
--   no column default after this migration, so a new insert must set intake.
-- * Adds students.chinese_name (text, nullable). No default. Existing rows
--   stay null. name stays the full English name.
-- * Drops the global unique constraint students_application_number_key.
--   That is the PostgreSQL name for the inline UNIQUE on application_number
--   in supabase_schema.sql.
-- * Adds unique (intake, application_number). The same four-digit code may
--   exist in two intakes. It may not exist twice in one intake.
-- * Rewrites six existing test application numbers before the four-digit
--   check. The student ids are not changed. Only these values are rewritten,
--   and only to digits:
--     APP-0001 -> 9001
--     APP-0002 -> 9002
--     APP-0003 -> 9003
--     APP-0004 -> 9004
--     APP-0005 -> 9005
--     APP-0010 -> 9010
--   If one of those new codes is already used in the same intake, the unique
--   key fails and this whole migration rolls back. Any other
--   application_number that is not exactly four digits also fails the check
--   and rolls the migration back.
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
  add column chinese_name text;

alter table public.students
  drop constraint students_application_number_key;

alter table public.students
  add constraint students_intake_application_number_key
  unique (intake, application_number);

update public.students
  set application_number = case application_number
    when 'APP-0001' then '9001'
    when 'APP-0002' then '9002'
    when 'APP-0003' then '9003'
    when 'APP-0004' then '9004'
    when 'APP-0005' then '9005'
    when 'APP-0010' then '9010'
    else application_number
  end
  where application_number in (
    'APP-0001',
    'APP-0002',
    'APP-0003',
    'APP-0004',
    'APP-0005',
    'APP-0010'
  );

alter table public.students
  add constraint students_application_number_four_digits
  check (application_number ~ '^[0-9]{4}$');

commit;
