# Bugbot

Treat a change as HIGH RISK when it touches any of the following. Say so in the review. Do not describe that change as a routine fix.

- Row Level Security policies, grants, or revokes
- `mcq-app/proxy.ts`, the auth and route gate
- Any `.env`, `.env.local`, or other `.env.*` file, and any use of a production Supabase key
- Security-definer functions
- Anything that exposes `correct_answer` or `access_token` to a browser, an export, a log, an error message, or a role that should not see it

Do not apply SQL from a review. Do not edit `proxy.ts` or an env file to clear a finding in the same change.
