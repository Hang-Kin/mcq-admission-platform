alter table questions enable row level security;
alter table students enable row level security;
alter table exams enable row level security;
alter table test_instances enable row level security;
alter table responses enable row level security;
alter table grades enable row level security;

create policy "Allow public read on questions"
on questions for select
using (true);

create policy "Allow public read on students"
on students for select
using (true);

create policy "Allow public read on exams"
on exams for select
using (true);

create policy "Allow public read on test_instances"
on test_instances for select
using (true);

create policy "Allow public insert on test_instances"
on test_instances for insert
with check (true);

create policy "Allow public read on responses"
on responses for select
using (true);

create policy "Allow public insert on responses"
on responses for insert
with check (true);

create policy "Allow public read on grades"
on grades for select
using (true);