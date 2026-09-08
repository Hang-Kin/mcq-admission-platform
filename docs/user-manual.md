# MCQ Admission Platform — User Manual

This manual covers day-to-day use of the platform for **admins** and **teachers**. It does not cover installation, deployment, or database internals — see `docs/decisions/` for those.

## 1. Roles

| Role | Can do |
|---|---|
| **Admin** | Everything: manage question bank, manage students, create/edit exams, generate QR sessions, grade text answers, finalize grades, promote/demote teacher and admin accounts. |
| **Teacher** | Read the question bank, students, exams, responses, and grades. Can create/edit questions and generate QR sessions for exams. Cannot add/edit students, exams, or grades directly, and cannot change anyone's role. |
| **Pending** | New signups default here. No access until an admin promotes the account. |

## 2. Generating a Student's Exam (QR Code)

1. Go to the exam's QR generator page as an admin or teacher.
2. Select the students taking the exam and the question set(s) to draw from.
3. Generate the per-student QR codes. Each QR code encodes a one-time link containing that student's unique access token — it is not reusable by another student.
4. Print or display the QR sheet for the exam sitting.

If a student hasn't started their exam yet (status still "pending"), you can regenerate their QR code freely — the old token is invalidated automatically. Once a student has started or submitted, regenerating is blocked and requires manual admin override, to prevent accidentally wiping in-progress work.

## 3. What Happens When a Student Scans Their QR Code

- The first scan locks the session to that device. If the student (or anyone else) tries to open the same link on a second device, they'll see a "session already active" message — this is intentional, and prevents two people from taking the same exam simultaneously under one student's identity.
- Answers autosave as the student works through each question — there is no single "final submit" button holding all the risk. If a connection drops mid-exam, only the very last unsaved change is at risk, not the whole attempt.
- The exam timer is enforced on the server, not just in the student's browser. If time runs out, the exam auto-submits even if the student's device is unresponsive or the tab is closed.

## 4. Grading — Read This Before Trusting Any Score

The platform auto-grades answers immediately as students submit them, so you'll see `is_correct` values appear right away. **These are not all equally trustworthy**, and one category in particular needs your attention every time:

### Radio and numeric questions

Graded automatically and reliably:
- **Radio** questions are graded as correct if the student's selected option matches the answer key, ignoring case and surrounding whitespace.
- **Numeric** questions are graded as correct if the student's answer is within 0.01 of the answer key (so "12" and "12.0" both count, avoiding false negatives from formatting differences).

These auto-grades are safe to trust as-is for day-to-day use.

### Text (essay-style) questions — MANDATORY MANUAL REVIEW

Text questions are open-ended prompts (e.g., *"Why do you want to join this program?"*, *"Describe a challenge you overcame..."*) — **they have no single correct answer stored in the system**. The `correct_answer` field for every text question is intentionally left blank/null in the question bank, because there is no fixed right answer to compare against.

Because of this:
- The system still records an automatic grading attempt on submission, but it cannot meaningfully judge an open-ended answer against nothing — you will see the auto-grade come back as unresolved/blank rather than a real true-or-false judgment.
- Every text answer is flagged **"needs review"** the moment it's submitted, specifically so it cannot silently count toward a final grade until a teacher has actually read it.
- **A teacher or admin must personally read and grade every text answer before that student's final grade is finalized.** This is a hard requirement, not a suggestion — the system is designed to block a final grade from being computed while any of a student's text answers are still unreviewed.

**What this means for you in practice:** after an exam sitting, go to the review screen (or the responses table, until the dedicated review screen is built) and manually mark every text answer as correct/incorrect (or assign whatever partial-credit approach your program uses) before you consider that student's results final. Do not report or export a grade for a student who still has unreviewed text answers.

As a matter of due diligence, it's also worth spot-checking a handful of the auto-graded radio and numeric answers per sitting — not because they're unreliable, but as a general sanity check on the question bank's answer keys.

## 5. Managing Roles

Only admins can change a user's role, and only through the platform's official role-change action — there is no way for a signed-in user to edit their own role, even by mistake. New signups always start as "pending" and must be manually promoted by an admin to "teacher" or "admin".

## 6. Getting Help

For anything not covered here — schema questions, security decisions, or why a particular design choice was made — see the architecture decision records in `docs/decisions/` in the project repository.
