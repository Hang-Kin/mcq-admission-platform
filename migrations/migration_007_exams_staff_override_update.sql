-- migration_007_exams_staff_override_update.sql
-- Proposed. Do not apply until reviewed.
--
-- Why: exams UPDATE is admin-only today (teachers are read-only on exams).
-- Teachers must be able to set exams.active_timeslot_override from the
-- timeslot admin UI. Postgres RLS cannot restrict an UPDATE to one column,
-- so this pairs a staff UPDATE policy with a trigger that rejects any
-- non-admin change to other exam columns.
--
-- Does not change timeslots RLS, start_session, or other exam writes.

create or replace function public.exams_restrict_staff_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return NEW;
  end if;

  if (to_jsonb(NEW) - 'active_timeslot_override')
       is distinct from (to_jsonb(OLD) - 'active_timeslot_override') then
    raise exception 'staff may only update active_timeslot_override'
      using errcode = '42501';
  end if;

  return NEW;
end;
$$;

revoke execute on function public.exams_restrict_staff_updates() from public;
revoke execute on function public.exams_restrict_staff_updates() from anon;
revoke execute on function public.exams_restrict_staff_updates() from authenticated;

drop trigger if exists exams_restrict_staff_updates on public.exams;
create trigger exams_restrict_staff_updates
  before update on public.exams
  for each row
  execute function public.exams_restrict_staff_updates();

drop policy if exists "exams_update_staff_override" on public.exams;
create policy "exams_update_staff_override" on public.exams
  for update to authenticated
  using (is_staff())
  with check (is_staff());
