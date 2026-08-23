# spec.md

## Tables

### questions
- id
- question_text
- category (A/B/C/D)
- type (radio / numeric)
- options (for radio type)
- correct_answer

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
- id
- test_instance_id
- question_id
- student_answer

### grades
- id
- student_id
- exam_id
- final_grade