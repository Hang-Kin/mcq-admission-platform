# Hosting and handover

Vercel runs the app. Supabase runs the database. The live site reads its Supabase address and public key from the Vercel project settings. Those values are not stored in git. This note has no passwords and no keys.

Screenshots are missing. There was no staging run, so this note has no pictures of the Vercel or Supabase screens.

## Plans

A school deployment needs **Vercel Pro** and **Supabase Pro**. Check current pricing.

Vercel Hobby is for personal, non-commercial use. Do not use it for the school exam.

A Supabase free project pauses after about a week of low activity. Supabase Pro does not pause. Use Pro for a real exam so the database is still there on the morning of the test. Check current pricing.

On Vercel Pro, set a spending cap before the exam period. If Supabase Pro offers a spend cap on the current plan, set that too. Check current pricing for what each plan includes, including backups.

## Region

The launch plan is to run the database in **Singapore**, not Sydney, and to set the Vercel region to Singapore so the app and the database match.

A Supabase project does not switch region in place. The region is chosen when the project is created. Do this before exam week, with the account owners:

1. Create a new Supabase project in Singapore, on Supabase Pro. Check current pricing.
2. Move the data with the dashboard backup and restore for the current plan. Check current pricing for whether that restore into a new project is included. Do not write a SQL script for the move, and do not put a backup file in git.
3. Point the Vercel environment variables at the new project address and public key. Leave the values in Vercel. Do not commit them.
4. In the Vercel project settings, set the function region to Singapore.
5. Open the site and one exam link. If the domain changes, check the Supabase auth redirect URLs as well.
6. Keep the Sydney project until the Singapore site has been checked. Remove or pause the old project only after the owners agree.

## Backups

The app on Vercel is rebuilt from git. Student answers live only in Supabase. Rolling back a Vercel deployment does not restore answers.

### Download a backup

1. Confirm the project is on Supabase Pro. Check current pricing. The free plan can pause, and it does not promise the same backups.
2. In the Supabase dashboard, open this project and download a backup before each exam day.
3. Store the file with the school, outside git. Write down the time of the download and who has the file.
4. Check current pricing for how long backups are kept and whether point-in-time restore is included.

### Restore

1. Tell staff to stop marking, and tell them a restore is about to happen.
2. In the Supabase dashboard, restore the backup you downloaded, or use point-in-time restore if the current plan includes it. Check current pricing for how far back that goes.
3. Open the site. Check one known student and one known sitting before anyone continues.
4. Tell staff the backup time. Marks entered after that time need to be entered again.
5. Do not change the database by hand during an exam.

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

DNS for the school domain points at Vercel. After any domain change, check the Supabase auth redirect URLs as well as the site itself. Write down the custom domain and the spending caps with the owners above.

## If it breaks

1. The site does not load. In Vercel, open Deployments. If the latest deploy failed, roll back to the previous deployment. Do not change the database during an exam. A Vercel rollback does not restore answers.
2. The site loads, but exam links fail or data does not save. In Supabase, open the project. If it is paused, restore it. Free projects pause after about a week of low activity. Supabase Pro does not. If the project was just moved, confirm Vercel still points at the Singapore project and that the function region is Singapore.
3. Rows are missing or wrong after a bad change. Follow **Restore** above. Say so to the staff before anyone re-enters marks. Check current pricing for how far back the backup goes.
4. A bill looks wrong. Check the spending cap on Vercel and on Supabase. Check current pricing.
5. Tell the owners in the table above. Do not paste keys, tokens, or passwords into email or chat.

Day-to-day use of sittings, QR sheets, Settings, and review is in `docs/user-manual.md`. Items still open before launch are in `docs/launch-checklist.md`.
