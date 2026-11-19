# Migrations

These files are the record of what is live. Do not apply this folder as a
batch, and do not re-apply a file that is already live.

Applied live: 001 to 003 (as the phase_b and role migrations) and 006 to
026 and 028, except 010, which has no file. 004 is a snapshot only. Do not
apply it. 027, 029, 030, and 031 are applied on staging, NOT applied on
live. Do not apply them to live until reviewed.

There is no migration 010. 005 was committed and then removed; it was
never applied.

`supabase_schema.sql` and `rls_setup.sql` are the original setup scripts,
not this history. `rls_setup.sql` still contains the policy that 028
dropped. Do not re-run either script.

Files 024 and 026 still say "Not applied" in their own headers. That line
is stale. Both are in the applied-live set above. Do not re-apply them
from those headers.

## Index

| Migration | Applied live | What it changes | Superseded by |
| --- | --- | --- | --- |
| 001 | Yes. Phase_b and role migration. The file `migration_001_role_rls.sql` is not in this repo. `is_staff()` is `profiles.role in ('admin', 'teacher')`. | Role helpers and staff RLS. | Not replaced as a file. Later files widen some staff writes: 007, 008, 015. 024 changes question grants. |
| 002 | Yes. Applied with 001 and 003 as the phase_b and role migrations. No `migration_002` file is in this repo. | No body in this repo. | No later file names a replacement. |
| 003 | Yes. `migration_003_student_rpc.sql` was never committed. | Original student RPCs, including `start_session` and `submit_answer`. | `start_session` by 006, then each later replacement. `submit_answer` is snapshotted in 004 and replaced by 013, 017, and 019. |
| 004 | Snapshot only. Not in the live history. Do not apply. | 2026-09-11 snapshot of `submit_answer` (case-insensitive text, numeric tolerance 0.01). | 013, then 017, then 019 (exact numeric). 022 and 024 are later live changes that also post-date this snapshot. Re-applying 004 would overwrite the newer function. |
| 005 | No. File removed. Never applied. | Would have added `responses.reviewed_at` and `reviewed_by`. | 011 (same columns, renumbered). |
| 006 | Yes | `timeslots`, exam override, `test_instances.timeslot_id`, and a new `start_session`. | `start_session` by 009. The timeslots table remains. |
| 007 | Yes | Teachers may insert students (`students_insert_staff`). | Not superseded. |
| 008 | Yes | Staff may update `exams.active_timeslot_override` only. Renamed from a draft that was also numbered 007. | Not superseded. |
| 009 | Yes | Timeslot question set is shared by every student in that sitting. Closes a public-read gap on `exams`. | `start_session` by 012. |
| 010 | No file. Number not used. | — | — |
| 011 | Yes | `responses.reviewed_at` / `reviewed_by`, and one grades row per student per exam. | Not superseded. 026 adds the same response columns with `if not exists` and does not replace this file. |
| 012 | Yes | `questions.image_url`, public `question-images` bucket, `image_url` on the session payload. | `start_session` by 013. The column and bucket remain. |
| 013 | Yes | Exam sections, section helpers, `advance_section`, and replacements of `start_session` and `submit_answer`. | `start_session` by 016. `submit_answer` by 017. `exam_section_questions` by 020. `advance_section`, `exam_section_view`, and `exam_section_catch_up` are not replaced later. |
| 014 | Yes | Drops unused `exams.schedule_time`. | Not superseded. |
| 015 | Yes | Teachers may insert exams (`exams_insert_staff`). | Not superseded. |
| 016 | Yes | Per-sitting question sets for sectioned exams, and `resolve_exam_timeslot`. | `start_session` by 017. `resolve_exam_timeslot` by 025. |
| 017 | Yes | Subject draw, fraction answers, `timeslot_draws`, and replacements of `start_session` and `submit_answer`. | `start_session` by 018. `submit_answer` by 019. Draw helpers remain. |
| 018 | Yes | Subject topic order, and section minutes taken from subject settings. | `start_session` by 021. |
| 019 | Yes | Numeric grading is exact equality. Removes the 0.01 tolerance from the 004 snapshot. | Not superseded. This is the current `submit_answer` in the repo. |
| 020 | Yes | `exam_section_questions` also returns `subject`. `correct_answer` stays omitted. | Not superseded. |
| 021 | Yes | A section with a subject and no prepared draw returns `not_prepared`. | `start_session` by 023. |
| 022 | Yes | Student `intake` and `chinese_name`. Application numbers are unique per intake. | Not superseded. Does not replace `submit_answer`. It is one of the live changes after the 004 snapshot. |
| 023 | Yes | Locks section minutes after the first student starts. | `start_session` by 025. The minutes trigger is not replaced. |
| 024 | Yes. The file header still says "Not applied"; that line is stale. | Revokes anon `SELECT` on `questions.correct_answer`. Does not replace `submit_answer`. | Not superseded. Later than the 004 snapshot. |
| 025 | Yes. Already applied. Do not re-apply. | Archive column, archived sittings are skipped by `resolve_exam_timeslot`, and `delete_sitting_test_data`. `start_session` matches live SQL: both "does this exam have timeslots" checks do not filter `archived_at`. Archived filtering stays in the picker (`resolve_exam_timeslot`, and the schedule list). | `start_session` by 030 when 030 is applied. 030 is not applied, so this file is still the live `start_session`. The archive column, `resolve_exam_timeslot`, and `delete_sitting_test_data` stay. |
| 026 | Yes. The file header still says "Not applied"; that line is stale. | Teacher confirm, override, and regrade tables and functions. Does not replace `submit_answer`. | Not superseded. |
| 027 | Applied on staging, NOT applied on live. Do not apply to live until reviewed. HIGH RISK. | Refuses confirming an ungraded answer. Revokes direct writes on `response_marks` and `regrade_log`. Regrade recomputes the mark on the server. | Not applied on live. 026 remains the live marking functions until this is reviewed. |
| 028 | Yes. Already applied live on 5 Nov 2026. Do not run it again. | Drops policy "Allow public read on test_instances". | Not superseded. |
| 029 | Applied on staging, NOT applied on live. Do not apply to live until reviewed. HIGH RISK. | Indexes for unindexed foreign keys. Wraps `auth.uid()` in the flagged policies. Removes duplicate permissive policies on `questions`, `exams`, and `profiles`. Final overlap check counts a pair only when role sets intersect (`&&`). | Not applied on live. |
| 030 | Applied on staging, NOT applied on live. Do not apply to live until reviewed. HIGH RISK. | `start_session` also returns `saved_answers` for that token and session. Does not read or return the answer key. Grants restated, not widened. | Not applied on live. 025 remains the live `start_session` until this is reviewed. |
| 031 | Applied on staging, NOT applied on live. Do not apply to live until reviewed. HIGH RISK. | Teachers may delete questions (`questions_delete_staff`). Recreates the staging policy set on `questions`, `exams`, and `profiles`. File only in this repo; do not run it here. | Not applied on live. |

## Do not apply

- 004. Historical snapshot. Superseded. Do not apply.
- 005. Never applied. 011 already added those columns.
- 025 and 028. Already live. The files match that history. Running them again is not this record.
- 027, 029, 030, and 031. Applied on staging, NOT applied on live. Do not run them against live until they are reviewed. Do not run 031 from a cloud agent.
