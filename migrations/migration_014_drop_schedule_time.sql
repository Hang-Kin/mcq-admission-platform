-- migration_014_drop_schedule_time.sql
-- Proposed. Do not apply until reviewed.
--
-- exams.schedule_time is unused. The app never reads or writes it.
-- Dropping the column does not change exam_sections, timeslots, or the
-- session RPCs. Those read duration_minutes and active_timeslot_override
-- by name.
--
-- Apply this only after the exams list no longer selects schedule_time.
-- The previous list page selected the column, so dropping it first makes
-- that page fail to load.

alter table public.exams
  drop column schedule_time;
