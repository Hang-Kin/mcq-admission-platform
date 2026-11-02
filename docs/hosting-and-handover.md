# Hosting and handover

Vercel runs the app. Supabase runs the database. The live site reads its Supabase address and public key from the Vercel project settings. Those values are not stored in git. This note has no passwords and no keys.

## Plans

A Supabase free project pauses after about a week of low activity. A paid Supabase project does not pause. Use a paid project for a real exam so the database is still there on the morning of the test. Check current pricing.

Vercel Hobby is for personal, non-commercial use. A school deployment needs Vercel Pro. Check current pricing.

On the paid Vercel plan, set a spending cap before the exam period. If Supabase offers a spend cap on the current plan, set that too. Check current pricing for what each plan includes.

## Backups

The app on Vercel is rebuilt from git. Student answers live only in Supabase. Rolling back a Vercel deployment does not restore answers.

Before each exam day, confirm the Supabase project is on a paid plan and that a backup exists. Check current pricing for how long backups are kept and whether you can restore to a point in time. Download a backup through the Supabase dashboard. Do not put backup files in the git repo.

The free plan can pause, and it does not promise the same backups. Check current pricing.

## Who owns the accounts and the domain

The school should own the Vercel account, the Supabase account, and the domain. Use a school email, not one teacher's private login. At least two people should be able to recover each account. Keep the passwords in the school password store.

The GitHub repository is `Hang-Kin/mcq-admission-platform`. Confirm who is allowed to merge into `main`.

Fill this in at handover:

| Thing | Owner | Login email | Second person who can recover it |
| --- | --- | --- | --- |
| Vercel | | | |
| Supabase | | | |
| Domain and DNS | | | |
| GitHub | | | |

DNS for the school domain points at Vercel. After any domain change, check the Supabase auth redirect URLs as well as the site itself.

## If it breaks

1. The site does not load. In Vercel, open Deployments. If the latest deploy failed, roll back to the previous deployment. Do not change the database during an exam.
2. The site loads, but exam links fail or data does not save. In Supabase, open the project. If it is paused, restore it. Free projects pause after about a week of low activity. Paid projects do not.
3. Rows are missing or wrong after a bad change. Restore the latest Supabase backup. Check current pricing for how far back that backup goes. Say so to the staff before anyone re-enters marks.
4. A bill looks wrong. Check the spending cap on Vercel and on Supabase. Check current pricing.
5. Tell the owners in the table above. Do not paste keys, tokens, or passwords into email or chat.
