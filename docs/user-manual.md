# MCQ Admission Platform — User Manual

This manual is for **admins** and **teachers** on a normal exam day. Installation, plans, backups, and what to do when the site is down are in `docs/hosting-and-handover.md`.

Screenshots are missing. There was no staging run, so this manual has no pictures of the sittings page, the QR sheet, review, or Settings.

## 1. Roles

| Role | Can do |
|---|---|
| **Admin** | Question bank, students, exams, sittings, QR sheets, review, and regrade. Can finalize a grade, delete a sitting time, and delete test data. Can promote or demote teacher and admin accounts. |
| **Teacher** | Question bank, exams, sittings (prepare questions, archive, restore, and change a time that no student has started), QR sheets, review, confirm, edit, and regrade. Cannot finalize a grade, delete a sitting time, or delete test data, and cannot change anyone's role. |
| **Pending** | New signups default here. No access until an admin promotes the account. |

If a button answers that you may not have permission, stop and ask an admin. Do not work around it.

## 2. Sittings and archive

Open **Sittings**. Times on this page are Hong Kong time.

1. Name the exam. Math and Chinese are added for you.
2. Add a time. The page warns when two times overlap. A sitting that ends at the same minute another starts does not overlap.
3. **Prepare questions** draws that sitting from the Math question bank, then the Chinese question bank. The status becomes **Prepared**.
4. **Redraw** replaces those questions. The page asks you to confirm before it replaces them.
5. After a student starts, the sitting is **Locked (students started)**. The time stays as it is, and the questions are not redrawn.

A sitting that starts within a day and is still **Not prepared** is marked so you can prepare it before the students arrive.

**Archive** takes a sitting off the active list. It does not delete answers. Choose **Show archived**, then **Restore**, to put it back. **Hide archived** returns to the active list.

Only an admin can delete a time, and only when no student is linked and nobody has started. If students are linked, or someone has started, the time is not deleted. Archive it, or delete the test data.

**Delete test data** is for an admin clearing a practice sitting. The page counts the students, answers, and results it will remove, and it removes the sitting as well. Type `DELETE` to confirm. Nothing is removed until that word matches.

**Day view** shows the same times as blocks. Hours are Hong Kong time. Overlaps are marked in red. A block opens that sitting.

## 3. QR sheets

On **Sittings**, the **QR codes** section is there once the exam has Math and Chinese. The same generator is also on that exam's QR page.

1. Choose the intake.
2. Tick the students, or choose **Select all pending for this intake**.
3. **Create QR codes** downloads a PDF for the students you ticked in that intake.
4. **Download PDF** downloads the current codes and does not replace them.

Create skips a student who has already started. A student who has not started gets a new code, and any earlier code for that student stops working. Download does not do that.

The PDF is A4, five cards to a page, with cut lines between the cards. Each card shows **提交編號**, the English name, the Chinese name, and the QR code. The code is that student's own link.

If a name cannot be printed, or it is too long for the card, the download stops and names those students. Fix the names, then try again.

An older exam that has no sections still asks for question sets and a number of questions on its QR page. An exam that uses sections does not. Its questions come from the banks when you prepare the sitting.

## 4. What happens when a student scans

- The first open locks the sitting to that device. Opening the same link on a second device shows that the exam is already open on another device.
- Answers save as the student works. A dropped connection risks the last unsaved change, not the whole attempt.
- The timer is enforced on the server. When time runs out, the sitting submits even if the tab is closed.

## 5. Settings and themes

The **Settings** control is in the staff navbar. It is not on the student exam screen.

It changes this browser only, and it says **Saved in this browser**.

| Setting | Choices |
|---|---|
| **Language** | English or Traditional Chinese. This changes the navbar, menus, Settings, and admin pages. |
| **Colour** | Normal, Dark high contrast, or Light high contrast. |
| **UI size** | 50%, 75%, 100%, 125%, 150%, 175%, or 200%. **Reset** returns to 100%. |

**Subject settings** is a different page, under Questions. It sets how many questions come from each topic, and how many minutes students get, for Math and Chinese. Exam sections use those minutes until a student starts. After a student starts, that exam keeps the minutes it had.

## 6. Review and regrade

Open **Results** after sittings are submitted. The page lists scores, then written answers that still need a teacher. Export downloads submitted results for one exam. Times in that file are Hong Kong time.

Open a student's name to review that sitting.

### How a mark is decided

- **Radio** matches the answer key after ignoring case and surrounding spaces.
- **Numeric** matches by exact numeric equality. `5` and `5.0` match. `0.94` does not match `0.93`. A blank numeric answer is incorrect. A missing answer, or a missing correct answer, stays ungraded.
- **Fraction** matches the stored text after trimming. `2/4` does not match `1/2`.
- **Text** has no single correct answer to trust. It stays **Needs a teacher** until someone marks it.

The score uses a teacher's override when one is set. Unanswered assigned questions stay in the total and count as incorrect.

### Confirm, edit, and confirm all

On the sitting, each answer shows the system judgement, the stored correct answer, and the teacher state: unconfirmed, confirmed, or overridden.

- **Confirm** accepts the system mark and clears an override.
- **Edit** sets that answer correct or incorrect. A note is optional. That mark is an override.
- **Confirm all** confirms every stored answer that is still unconfirmed. It does not change an override.

The number rail on the left uses the same marks: filled colour is correct, red is incorrect, plain is not graded. A ring means confirmed. A bar on the left means overridden.

Written answers on the Results page can be marked correct or incorrect from the queue. **Review all answers** opens the whole sitting.

A grade cannot be finalized while any answer still needs review. Only an admin can **Finalize grade**. If marks change after that, the sitting shows **Changed since finalize**, and the admin can finalize again.

### Regrade

Changing the saved correct answer does not change marks already stored. Open **Regrade affected students** for that question. The page shows the previous correct answer, when it was passed in, the new correct answer, how many students and answers would change, and how many overridden marks will be kept. Overridden marks stay as the teacher set them.

**Regrade affected students** writes the preview. If the saved correct answer changed again, refresh the page before regrading. If nothing would change, there is nothing to apply.

Spot-check a few radio and numeric answers after a sitting, as a check on the answer key.

## 7. Managing roles

Only an admin can change a user's role, and only through the platform's role-change action. A signed-in user cannot edit their own role. New signups start as pending until an admin promotes them to teacher or admin.

## 8. If it breaks

Teachers: stop marking and tell an admin. Do not paste keys, tokens, or passwords into email or chat.

Admins: follow **If it breaks** in `docs/hosting-and-handover.md`. Rolling the site back does not restore student answers. Restoring answers is a database restore, and staff need to know which marks came after the backup.

## 9. Getting help

Schema and security decisions are in `docs/decisions/`. Launch items still open are in `docs/launch-checklist.md`.
