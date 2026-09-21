-- migration_007_students_insert_staff.sql
-- What: let teachers (and admins) insert roster rows. Update and delete stay
-- admin-only. Live policy is currently students_insert_admin / is_admin(),
-- which is why a teacher cannot add students today.
--
-- Does not change students_update_admin or students_delete_admin.

drop policy "students_insert_admin" on public.students;

create policy "students_insert_staff" on public.students
  for insert to authenticated with check (is_staff());
