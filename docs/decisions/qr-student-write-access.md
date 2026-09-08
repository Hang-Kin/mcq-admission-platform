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

## Amendment (2026-09-08): Advisor Security Cleanup

After applying Phase A/B, `get_advisors` flagged two pre-existing
functions unrelated to this feature: `handle_new_user()` (the
`on_auth_user_created` trigger on `auth.users`, which seeds a `profiles`
row with role `'pending'`) and `rls_auto_enable()` (an event trigger that
auto-enables RLS on newly created tables in `public`). Both were exposed
as directly callable via `/rest/v1/rpc/...` for `anon` and
`authenticated`, and `handle_new_user` also had a mutable `search_path`.

### Fix Applied
- `alter function handle_new_user() set search_path = public, pg_temp;`
  — pins the search path.
- Revoked `EXECUTE` on both functions from `anon` and `authenticated`.
  Note: revoking from `PUBLIC` alone was not sufficient — both functions
  had *explicit* per-role grants in their ACL (visible via
  `pg_proc.proacl`), not just the implicit default-PUBLIC grant. Each
  role's `EXECUTE` had to be revoked individually.
- This is safe because both are trigger functions (a regular row trigger
  and an event trigger). Trigger execution runs with the function
  owner's privileges, not the invoking session's — removing EXECUTE from
  `anon`/`authenticated` does not stop either trigger from firing
  normally on `INSERT INTO auth.users` / `CREATE TABLE`. It only closes
  the direct-RPC-call exposure.
- Verified via `get_advisors` after each step: both functions no longer
  appear in either the anon or authenticated `security_definer_function_executable`
  findings, and the `function_search_path_mutable` finding is gone.

### Leaked Password Protection: Accepted Free-Tier Limitation
`auth_leaked_password_protection` remains WARN and will stay WARN for now.
The toggle lives in Supabase Dashboard > Authentication > Sign In / Providers
> Email > "Prevent use of leaked passwords" (checks HaveIBeenPwned.org via
the Pwned Passwords API on signup/password change). Checked on 2026-09-08:
the toggle is greyed out because the KH Studio organization is on the
Supabase **Free** plan — this feature requires **Pro plan or above**
(confirmed via `get_organization`: plan = "free"). No connector tool can
bypass this; it is a billing-tier restriction, not a config or code fix.

Decision: accept this as a known limitation rather than upgrading solely
for this warning. It only affects the staff/admin email+password login
flow (Supabase Auth) — it does NOT affect the student QR/token flow, which
never touches Supabase Auth at all. Revisit if/when the project upgrades
to Pro for other reasons (e.g. daily backups, log retention).

### Remaining Known Warnings (Intentional, Not Gaps)
`start_session`, `submit_answer`, and `submit_exam` still show as
`anon`-executable `SECURITY DEFINER` functions. This is by design —
students are not Supabase Auth users and must reach these functions via
the anon key; the `access_token`/`session_id` check inside each function
is the actual authorization boundary, not role membership. Do not revoke
`anon` execute on these three.
