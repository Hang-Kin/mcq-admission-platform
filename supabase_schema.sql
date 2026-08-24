create table questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  category text not null,
  type text not null check (type in ('radio', 'numeric', 'text')),
  options jsonb,
  correct_answer text,
  created_at timestamptz default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique,
  name text,
  created_at timestamptz default now()
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes int not null,
  schedule_time timestamptz,
  created_at timestamptz default now()
);

create table test_instances (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id),
  student_id uuid references students(id),
  assigned_question_ids jsonb not null,
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz default now()
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  test_instance_id uuid references test_instances(id),
  question_id uuid references questions(id),
  student_answer text,
  is_correct boolean,
  graded_by text check (graded_by in ('auto', 'manual')),
  created_at timestamptz default now()
);

create table grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  exam_id uuid references exams(id),
  final_grade numeric,
  finalized_at timestamptz,
  created_at timestamptz default now()
);