# ADR: Student Write Access for QR/Session Flow

Status: Decided (2026-09-04)

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

## Implementation Notes (not yet built)
- Requires `test_instances` columns: `access_token` (unique text),
  `expires_at` (timestamptz), `status` (pending/in_progress/submitted) —
  not yet applied to the live database as of 2026-09-04.
- Needs two functions minimum: `start_session(access_token)` and
  `submit_answer(access_token, question_id, answer)`, both `security
  definer`, both with `set search_path = public` to avoid the mutable
  search_path vulnerability already flagged by Supabase's advisor on the
  existing `handle_new_user()` function.
- Run `get_advisors` (security) immediately after drafting these functions,
  before applying, to confirm no new exposure warnings.
- Cursor should only be given the frontend spec (call this RPC with this
  token, handle these error states) — the SQL itself should be
  hand-reviewed by Lee Onardo and partner before it goes live, per team
  workflow rules.

## Explicitly Rejected
Anonymous auth (`signInAnonymously()`) — rejected due to device-switch
fragility conflicting with exam-day reliability needs.
