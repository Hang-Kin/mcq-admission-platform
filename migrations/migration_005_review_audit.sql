-- migration_005_review_audit.sql
-- Proposed, NOT applied. Schema changes need explicit sign-off.
-- The review-queue UI does not read or write these columns.

alter table public.responses
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users (id);
