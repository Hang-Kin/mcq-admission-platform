# Extreme-value test checklist

Use a test intake and a short exam. Do not run these on a live sitting. Times are Hong Kong time (`Asia/Hong_Kong`). Set the computer clock to Hong Kong time before you type a slot, because the time boxes use the computer's clock.

Write pass or fail, and what you saw, next to each item.

## Student

### Answers nothing

Open the exam and do not choose or type any answer. Leave the question on screen until the timer reaches zero.

Pass: the exam is submitted by itself. No answer is invented. Blank questions are not marked correct. The student sees that the exam has been submitted and cannot keep going.

### Answers instantly

On every question, choose or type an answer and move on at once. Then submit.

Pass: the last answer you chose for each question is stored, and the exam submits once. If the screen still says the answer is saving, wait until it says saved before you close the page. A change that has not finished saving can be missing.

### Refreshes mid-question

Answer one question and wait until it says saved. Reload the same link. Then try again, and reload before the save finishes.

Pass: a reload does not start a second exam or hand out a new set of questions. Answers that had finished saving are still in the teacher's review. Write down the message on the reloaded page. Today a reload shows "This exam is already open on another device", because the open page does not keep its lock across a reload. A change that had not finished saving can be missing.

### Loses internet mid-test

Save one answer. Turn the network off. Change the answer. Turn the network back on.

Pass: the answer that had finished saving is still there. While the network is off, the screen shows that the new save failed. The exam does not submit itself only because the network dropped. The offline change is not sent by itself. After the network returns, change the answer again and confirm that save works.

### Opens the link on two devices

Start the exam on device A. Open the same link on device B.

Pass: device B shows "This exam is already open on another device" and cannot save answers. Device A can keep answering. Answers from device A stay stored.

### Timer hits zero while a question is open

Use a timer of a few minutes. Leave a question open, with an answer that already says saved, until the timer reaches zero.

Pass: an exam with no sections submits by itself and the student sees "Exam submitted". An exam with sections finishes that section, and submits if it was the last section. The student cannot keep editing the finished section. The answer that had finished saving is stored. A change made in the last moment, before it says saved, can be missing.

### Scans a deleted or replaced QR

While the sitting is still pending, create a QR, copy the link, then create a new QR for the same student. Open the old link, then the new link.

Pass: the old link shows "This link is invalid" and writes nothing. The new link opens the exam.

After the student has started, ask for a new QR for that student.

Pass: the started student is skipped, and the original link still opens the same sitting.

There is no delete button for a QR. On a test database only, remove that sitting's token, or replace a pending code as above, and open the old link.

Pass: the old link shows "This link is invalid" and does not start an exam.

## Teacher

### Slot of exactly the exam length

Use an exam with no sections, so there is one timer. Set the exam length to 5 minutes. Create a slot from 09:00 to 09:05 Hong Kong time, with a question set that already exists.

One student scans at 09:00. Another scans at 09:04.

Pass: both timers show 5 minutes from the moment of the scan, not the minutes left in the slot. The 09:04 student is still in the exam after 09:05. The slot ending does not submit the exam. Both students get that slot's question set.

### Slot one minute shorter

On the same 5-minute exam, create a slot from 10:00 to 10:04 Hong Kong time. A student scans at 10:00.

Pass: the timer shows 5 minutes, not 4. At 10:04 the exam is still open. It ends when the 5 minutes are up, or when the student submits. The shorter slot does not cut the exam off one minute early.

### Empty file

On Students → Import, upload a `.csv` or `.xlsx` with no rows. Then upload a file that has only the header row `提交編號`, `English Name`, `Chinese Name`. Then upload a file that has that header and only blank rows.

Pass: an empty file says `The file has no rows.` A header with no students, or only blank rows, says `The file has no students.` Nothing is saved.

### 5,000-row file

Build a file with the header row and 5,000 student rows. Use codes `0000` through `4999`, stored as text so the leading zeros stay. Keep the file under 5 MB. Upload it on a fresh test intake.

Pass: the preview lists 5,000 students and import is allowed. The stored codes still have their leading zeros.

Add one more student row (5,001 data rows) and upload that file.

Pass: import is refused with `Import 5000 students or fewer at a time.` Nothing from that file is saved.

A file over 5 MB is refused earlier with `The file is larger than 5 MB.`

Sample files for the other import cases are in `test-data/`: `roster_clean.xlsx`, `roster_extreme.xlsx`, and `roster_wrong_headers.csv`.
