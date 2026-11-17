# Extreme-value test results

Staging only. The app was run locally against the staging project whose host starts with `https://zdprf`. Subject settings were read as Math 8 minutes and 2 questions per topic, Chinese 8 minutes and 2 questions per topic. A one-minute trial was saved and then put back; the settings screen showed 8 and 8 again while it was saving.

Times below are Hong Kong time. The browser timezone was `Asia/Hong_Kong`.

## Student

### Answers nothing

Not tested. A one-minute section length was saved, but the new sitting never opened, so no paper was left on screen until the timer reached zero.

### Answers instantly

Pass for the answers that were entered. On a 1024px paper the run answered five questions (numeric, numeric, fraction, fraction, numeric) and moved on as soon as each one said saved, then submitted. Reload kept the same question index. After Back, question 5 still showed the numeric answer `4`. The run did not answer every question before submit, so blank questions were submitted with it. 375px and 768px each answered one numeric question, reloaded, and submitted once.

### Refreshes mid-question

Pass for a reload after the save had finished. The paper stayed on question 6 of 12, the timer was still counting (about 07:47), and it did not say the exam was open on another device. That differs from the older note in the checklist, which expected the other-device message on every reload. A reload that interrupts a save before it says saved was not isolated.

### Loses internet mid-test

Not tested. No paper was still in progress when this step ran.

### Opens the link on two devices

Pass. The second context showed: "This exam is already open on another device. This sitting is locked to the device that opened it first. Close that session, or ask a teacher if you need to switch devices."

### Timer hits zero while a question is open

Not tested. No paper was left open until the clock reached zero.

### Scans a deleted or replaced QR

Not tested. A second code was not issued for a student who already had one, and no old link was opened afterwards.

## Teacher

### Slot of exactly the exam length

Not tested as written. The opened Math section showed a timer of about 08:00, which is the subject setting, on a sitting whose slot was much longer than the exam. Two students were not scanned at 09:00 and 09:04.

### Slot one minute shorter

Fail against the checklist's expected pass. While the exam needed 16 minutes, submitting a 5-minute slot returned "This slot is 5 minutes but the exam needs 16." The shorter slot was not created, so the exam was not observed staying open after the slot ended.

### Empty file

Pass for a header plus blank rows: the screen said "The file has no students." A file with no bytes was uploaded in the same step; the screenshot that remains is the blank-row file, so the empty-file sentence "The file has no rows." was not the message on that screenshot.

### 5,000-row file

Pass for the preview. A fresh 2035-11 intake preview said "5000 to add, 0 already there, 0 errors", and the codes on screen kept their leading zeros (`0000`). Import was started. The screen then showed "5000 added" and, while it still said "Importing…", a later count of "1000 already there". The 25 seeded students are on the 2026 October intake and were not removed.

The 5,001-row file was refused. Both language spans were in the page, and the text was "Import 5000 students or fewer at a time." The Chinese span used that same English sentence. A file over 5 MB was not uploaded after that.

Sample roster files in `test-data/` were not uploaded in this run.
