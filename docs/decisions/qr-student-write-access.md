# ADR: Student Write Access for QR/Session Flow

Status: Decided (2026-09-04), amended 2026-09-08

## Problem
Students access their exam via a QR-code link (`/session/[token]`) with no
Supabase Auth session. Every current RLS policy assumes `auth.uid()` exists.
Writing student answers/session state cannot safely go through a raw
`supabase.from(...).insert()` with the anon key — anyone could edit any
student's exam data via the public API.

## Options Considered
1. Security-definer Postgres RPC function, called via `supabase.rpc(...)`,
   validating `access_token` server-side, writing only to that one
   `test_instances` row.
2. Supabase anonymous auth (`signInAnonymously()`), giving each student a
   temporary logged-in session, with RLS policies checking the
   `is_anonymous` claim + token.

## Decision
Going with Option 1: security-definer RPC.

## Rationale
- Token-based identity survives device switches (phone scan -> laptop
  continue); anonymous auth sessions are tied to one browser and are lost
  on device change, tab close with cleared storage, etc.
- Matches the already-locked-in "double-scan lock" rule: first scan sets
  status = 'in_progress'; a second scan/device is rejected by the function
  checking status, not by accidental session loss.
- Narrower attack surface: one reviewed function vs. new RLS policies
  needed across every touched table for anonymous JWTs.
- Also fits shared-device usage (school-provided iPads reused across
  students/sittings) better than anonymous auth, since identity lives in
  the token/URL, not in device-tied browser storage.

## Implementation Notes
- `test_instances` gets columns: `access_token` (unique text),
  `expires_at` (timestamptz), `status`
  (pending/in_progress/submitted, default pending), `session_id` (text).
- `responses` gets `updated_at` (timestamptz) and a unique index on
  (test_instance_id, question_id) to support upsert-based autosave.
- Three RPC functions, all `security definer`, `set search_path = public`,
  with execute explicitly revoked from `public` and granted only to `anon`:
  - `start_session(token, session_id)` — validates token, transitions
    pending -> in_progress, issues a session_id on first call, rejects a
    second device that doesn't have the matching session_id, returns
    assigned questions (correct_answer excluded from the response).
  - `submit_answer(token, session_id, question_id, answer)` — validates
    token + session_id + expiry + that the question is in the assigned
    set, auto-grades, upserts into `responses`.
  - `submit_exam(token, session_id)` — atomic claim
    (`UPDATE ... WHERE status = 'in_progress' ... RETURNING`) so
    concurrent submit calls cannot both succeed.
- Client-side: `session_id` must be stored scoped to the specific token
  (e.g. a key like `session_id_<token>`), never a generic global storage
  key — required because school-provided iPads are shared across
  students/sittings, and a leftover global value could leak into the
  next student's session on the same device.
- Cursor should only be given the frontend spec (call these RPCs with
  this token, handle these error states) — the SQL itself is
  hand-reviewed by Lee Onardo and partner before it goes live, per team
  workflow rules.

## Explicitly Rejected
Anonymous auth (`signInAnonymously()`) — rejected due to device-switch
and shared-device fragility conflicting with exam-day reliability needs.

## Amendment (2026-09-08): Grading and Manual Review

### Decision
Auto-grading runs for all three question types (`radio`, `numeric`,
`text`) at answer-submit time, computing an immediate `is_correct` guess.
However, `text`-type answers are never treated as final on their own —
they require human confirmation before they can count toward a student's
final grade.

### Mechanism
- `responses` gets an added column: `needs_review boolean not null
  default false`.
- In `submit_answer`, this is set to `(question.type = 'text')` on every
  insert/update — true only for text-type answers, false for
  radio/numeric (which don't need a human check).
- Grading logic in `submit_answer`:
  - `numeric`: correct if `abs(answer::numeric - correct_answer::numeric)
    <= 0.01`
  - `radio` and `text`: correct if `lower(trim(answer)) =
    lower(trim(correct_answer))`

### Hard Requirement for Future Grade-Finalization Work
`grades.final_grade` is not computed anywhere yet as of this amendment.
Whenever that finalization feature is built, it MUST check for any
`responses` row on the `test_instance` where `needs_review = true` and
block finalization (or exclude that response from the computed score)
until a teacher has reviewed it. This is a hard blocker, not optional
polish — do not compute or display a final grade to a student or admin
while any of their text answers are still unreviewed.

### Future Screen (Not Yet Built)
A teacher-facing review page is required before grade finalization can
ship: shows the student's typed answer next to the auto-graded guess for
every text-type response (and, per due-diligence, should let a teacher
spot-check radio/numeric auto-grades too, not only text ones). The
teacher confirms or overrides `is_correct`, which flips `needs_review` to
`false` and sets `graded_by = 'manual'` on override. Until this screen
exists, no test instance with a text-type question can be safely
finalized.
