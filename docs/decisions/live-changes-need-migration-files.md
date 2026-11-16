# ADR: Every live change has a migration file

Status: Decided (2026-11-16)

## Rule

Every change that is applied to the live database has a migration file in
this repository. The file is the record of what went live. A change that
exists only in the database, or only as a dashboard click, is not done.

## Why

`migrations/migration_004_grading_tolerance.sql` is a snapshot of
`submit_answer` from 2026-09-11. It is not in the live migration history.
Later migrations changed grading. Re-applying 004 would overwrite a newer
function.

`migration_025_delete_sitting_cascade.sql` had drifted from the live
`start_session`: the file excluded archived sittings from both "does this
exam have timeslots" checks. Live SQL does not. The file now matches live
SQL. It is already applied and must not be run again.

The policy "Allow public read on test_instances" was dropped in the live
database on 5 Nov 2026 with no file in the repo. That drop is now
`migrations/migration_028_drop_public_read_test_instances.sql`, marked
already applied.

## What this requires

- SQL that will be applied is a new numbered file under `migrations/`.
  Do not edit an already-applied file to sneak in a new change.
- If a live change was made outside the repo, add the file that matches
  what is already live, and say in the header that it is already applied.
  Do not run it again.
- A historical snapshot that is not the current function is labeled
  "Historical snapshot. Superseded. Do not apply."
- `supabase_schema.sql` and `rls_setup.sql` are the original setup scripts.
  They are not the live history. Do not re-run them to "catch up."
- This rule is the record. It is not permission to apply a file that has
  not been reviewed.
