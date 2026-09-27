-- migration_015_exams_insert_staff.sql
-- Proposed. Do not apply until reviewed.
--
-- Teachers create exams from /admin/exams/new. Live exams INSERT is
-- admin-only (docs/decisions/qr-student-write-access.md: staff can read
-- exams; only admin can insert). This adds a staff insert policy, matching
-- students_insert_staff. The existing admin insert policy is left in place.
-- Update and delete stay admin-only. The staff override trigger on
-- active_timeslot_override is unchanged.

drop policy if exists "exams_insert_staff" on public.exams;

create policy "exams_insert_staff" on public.exams
  for insert to authenticated
  with check (is_staff());
