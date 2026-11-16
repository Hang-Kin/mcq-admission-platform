# Launch checklist

Work through this list before a real exam. Plan prices are not written here. Check current pricing for Vercel Pro and Supabase Pro. Screenshots from a staging run are missing.

### Security
- [x] Drop "Allow public read on test_instances" (migration 028, applied 5 Nov)
- [ ] Close open sign-ups in Supabase Auth
- [ ] Leaked-password protection; two-step login for admins
- [ ] Migration 027 reviewed and applied
- [ ] Export formula escaping, security headers, `npm audit`
### Hosting
- [ ] Vercel Pro and Supabase Pro
- [ ] Move Supabase from Sydney to Singapore; set Vercel region to match
- [ ] Spending caps, custom domain, account ownership written down
### Database
- [ ] Migration files match live database (025, 028, 004 note)
- [ ] Index and policy cleanup (029)
### Testing
- [ ] Student and teacher dry runs on iPad and phone
- [ ] Load test with 50 students
- [ ] Extreme tests and accessibility pass
- [ ] Delete test sittings and dummy students
### Operations
- [ ] Backup and restore test
- [ ] Uptime and error monitoring
- [ ] Teacher manual, "if it breaks" page, training
### Business
- [ ] Proposal, demo video, handover document
