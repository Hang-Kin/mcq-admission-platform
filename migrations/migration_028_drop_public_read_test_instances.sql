-- migration_028_drop_public_read_test_instances.sql
-- Already applied live (5 Nov 2026). This file is the record of that drop.
-- Do not run it again.

drop policy if exists "Allow public read on test_instances" on public.test_instances;
