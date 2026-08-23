# spec.md

## Tables

### questions
- id (uuid, auto-generated)
- question_text (text)
- category (A/B/C/D)
- type (enum: 'radio' | 'numeric' | 'text')
  - radio: student selects from `options`, auto-graded via exact match
  - numeric: student types a number, input restricted to numeric characters, auto-graded via numeric comparison
  - text: student types free-response, no input restriction, NOT auto-graded — always requires manual review
- options (jsonb, only used when type = 'radio', null otherwise)
- correct_answer (text, optional — required for radio/numeric auto-grading, optional reference for text type)

### students
- id
- application_number
- name (optional)

### exams
- id
- name
- duration_minutes
- schedule_time

### test_instances
- id
- exam_id
- student_id
- assigned_question_ids

### responses
- id (uuid, auto-generated)
- test_instance_id (references test_instances)
- question_id (references questions)
- student_answer (text — stores whatever was selected or typed, regardless of question type)
- is_correct (boolean, nullable — null means "not yet graded," relevant for text-type answers awaiting manual review)
- graded_by (enum: 'auto' | 'manual' — lets the grading dashboard filter exactly which responses still need teacher attention)

### grades
- id
- student_id
- exam_id
- final_grade