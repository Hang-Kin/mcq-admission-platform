# Staging test results, part 2

Staging only. The app ran locally against the project whose host starts with `https://zdprf`. Subject settings at the start were Math 8 minutes and 2 questions per topic, Chinese 8 minutes and 2 questions per topic. Item 5 set both subject minutes to 1 last, then a `finally` block put them back to 8 and 8. The settings screen showed Math 8 and Chinese 8 after that save.

Lane F is not merged. Confirm all is reported as it behaves now.

`STAGING_PENDING_EMAIL` and `STAGING_PENDING_PASSWORD` are missing, so the pending-account test was skipped. No account was signed up through the app. Seeded students were not deleted. Staging rows created by the screens were left in place.

Screenshots and videos are in `/cursor/stores/bc-92314f63-d670-4644-be86-ba5aeb6af75c/media/staging-e2e-part2/`.

Command, from `e2e/`, with the app already on `http://127.0.0.1:3000`:

```
STAGING_E2E_MEDIA=/cursor/stores/bc-92314f63-d670-4644-be86-ba5aeb6af75c/media/staging-e2e-part2 \
npx playwright test tests/06-part2.spec.ts --reporter=list
```

Playwright exited 0 (`1 passed`, 16.9m). One script check inside that run recorded a fail for the teacher delete; the screen itself showed the question gone. That is described under item 2.

## 1. Pending account

Not tested. `STAGING_PENDING_EMAIL` and `STAGING_PENDING_PASSWORD` are missing.

## 2. Teacher permissions

Pass for add, edit, and delete. The teacher added a choice question, edited its text, and deleted it. The topic then showed `No questions in this topic yet.` and `0 of 2 questions`. Screenshot: `/cursor/stores/bc-92314f63-d670-4644-be86-ba5aeb6af75c/media/staging-e2e-part2/06-part2-teacher-deleted.png`.

The script's last assertion also saw a textarea that still held the old question text, so that assertion failed even though the topic list was empty. The test now waits only for the empty-topic sentence.

Pass for `set_user_role`. Called as the teacher, on that teacher's own id, with arguments `new_role` and `target_user`, trying to set the role to admin. Result: `HTTP 400 only admins may change roles`. The role was not changed.

## 3. Regrade

Pass. A fresh sitting was prepared after three Math topics were added through the bank screens: fraction (correct answer `1/2`), numeric (`4`), and written (`Hong Kong`), plus a second written question with no expected answer. Two students submitted.

### Confirm one

Pass. The numeric answer `4` showed `Confirmed by` the signed-in teacher, with the time `17 Nov 2026, 20:55 HKT` on that run.

### Edit to Incorrect

Pass. The fraction answer was edited to Incorrect with the note `E2E part2 override`. The line `Overridden by` appeared, with the same note, and `This question counts as Incorrect.` After the fraction regrade the override was still there.

### Regrade

Correct answers were changed through the bank edit screen, then regrade was opened and applied.

| Question | New correct answer | Preview | After apply |
| --- | --- | --- | --- |
| Fraction | `3/4` | `1 student would change (1 answer).` `1 overridden mark will be kept.` The other student's `1/2` would go from Correct to Incorrect. | `Regrade saved. 1 answer was updated. 1 overridden mark was kept.` |
| Numeric | `9` | `2 students would change (2 answers).` Both stored `4` marks would go from Correct to Incorrect. | `Regrade saved. 2 answers were updated. 0 overridden marks were kept.` |
| Written | `Macau` | Applied. The regrade log row for this question has `changed_count` 1 and `preserved_override_count` 0. | The exact answer `Hong Kong` changed from Correct to Incorrect. |

`regrade_log` for the three questions, read with the staff session: HTTP 200. One row `changed_count` 1, `preserved_override_count` 1 (fraction). One row `changed_count` 2, `preserved_override_count` 0 (numeric). One row `changed_count` 1, `preserved_override_count` 0 (written).

### Capitals and spaces on the written question

The key before regrade was `Hong Kong`. Both answers were typed through the exam.

| Typed answer | Before regrade | After the key became `Macau` and regrade ran |
| --- | --- | --- |
| `Hong Kong` | System judgement `Correct`. Also `Needs a teacher`. | System judgement `Incorrect`. |
| `  hONG   KONG  ` | System judgement `Incorrect`. Also `Needs a teacher`. The stored text kept the leading spaces and the extra spaces between the words. | System judgement `Incorrect`. |

They do not match after the regrade: neither answer is `Macau`. Before the regrade, the exact `Hong Kong` matched and the answer with different capitals and extra internal spaces did not. Edge spaces and capitals are folded. Spaces between the words are not.

Screenshots: `06-part2-text-before-exact.png`, `06-part2-text-before-varied.png`, `06-part2-text-after-exact.png`, `06-part2-text-after-varied.png`, `06-part2-regrade-fraction-applied.png`, `06-part2-regrade-numeric-applied.png`, `06-part2-regrade-text-applied.png`, `06-part2-override-after-regrade.png`.

## 4. Ungraded confirm, and Confirm all

The blank written question (no expected answer) was answered `needs a person` and submitted. The card showed `Not graded`, `Correct answer (none stored)`, `Unconfirmed`, and `Needs a teacher`.

Confirm on that card did not confirm it. The exact message under the buttons was:

`Could not save this mark. You may not have permission.`

The card stayed `Not graded` and `Unconfirmed`. Screenshot: `06-part2-ungraded-confirm.png`.

Confirm all, with Lane F not merged. The button was `Confirm all (2)`. After the click the button read `Saving…` and the line under it stayed:

`2 unconfirmed answers will be confirmed.`

There was no skipped-count sentence. The score panel on that paper said `2/44 correct (4.5%)`, `40 assigned questions were not answered and count as incorrect.`, and `2 responses need review before this grade can be finalized.` Screenshot: `06-part2-confirm-all.png`.

## 5. Timer reaches zero

Done last. Both subject minutes were set to 1, a new sitting was prepared, one fraction question was answered `1/2`, and the paper was left open.

- Opened on Math, `Question 1 of 30`, timer `00:59`. Screenshot: `06-part2-timer-open.png`.
- When the timer reached zero the screen was `Exam submitted` / `Your answers have been recorded. You can close this page.` Screenshot: `06-part2-timer-zero.png`. Video: `06-part2-timer.webm`.
- Reload showed `This exam has already been submitted` / `Your answers have already been recorded. You cannot open this exam again.` Screenshot: `06-part2-timer-reload.png`.
- On Results, that sitting's score was `1/44 correct`. The answered question was saved and counted. The other 43 questions were not counted as correct. The review copy used on these papers says unanswered questions stay in the total and count as incorrect (`40 assigned questions were not answered and count as incorrect.` on the longer paper in item 4).

Minutes were restored to 8 and 8. The settings screen showed Math 8 and Chinese 8. Screenshot: `06-part2-minutes-restored.png`.

## 6. Replaced QR

Pass. A code was issued, then a replacement for the same student before they started.

- Old link: `This link is invalid` / `The exam link you used is not recognised. Check the QR code or ask a teacher for a new link.` Screenshot: `06-part2-qr-old.png`.
- New link opened the paper: `Math`, `Question 1 of 36`, `Time remaining 07:59`. Screenshot: `06-part2-qr-new.png`.

## 7. Offline, and reload during a save

The offline change was not saved. After five answers were already saved, the network was turned off for 10 seconds and question 2 was changed from `1/2` to `3/5`.

The screen said `Couldn't save — try again`. The boxes still showed `3` and `5`. Screenshot: `06-part2-offline.png`.

After the network returned, the boxes still showed `3/5`. A further edit to `2/7` was started and the page was reloaded while that save was in flight. The reload came back as `2/7`, not `1/2` and not the offline `3/5`. The offline edit was lost. The later save was kept. Screenshot: `06-part2-reload-mid-save.png`.

## 8. Resume after migration 030

Pass. Five fraction answers were entered. Each was `1/2`. After reload, every one came back as `1/2`:

- Question 1, fraction, before `1/2`, after `1/2`
- Question 2, fraction, before `1/2`, after `1/2`
- Question 3, fraction, before `1/2`, after `1/2`
- Question 4, fraction, before `1/2`, after `1/2`
- Question 5, fraction, before `1/2`, after `1/2`

Screenshots: `06-part2-resume-before.png`, `06-part2-resume-after.png`. Video: `06-part2-resume.webm`.

## 9. Roster samples

Uploaded on the 2034 June intake. Import was not clicked.

| File | Line on screen |
| --- | --- |
| `test-data/roster_clean.xlsx` | `20 to add, 0 already there, 0 errors` |
| `test-data/roster_extreme.xlsx` | `6 to add, 0 already there, 8 errors` |
| `test-data/roster_wrong_headers.csv` | `The file needs a column named 提交編號 and English Name (or Full English name). ID and 參考編號 are ignored. Chinese Name is optional.` |
| A file of 5,000,001 bytes | `The file is larger than 5 MB.` |

Screenshots: `06-part2-roster-roster_clean.png`, `06-part2-roster-roster_extreme.png`, `06-part2-roster-roster_wrong_headers.png`, `06-part2-roster-huge.png`.

## 10. Slot equal to the exam length

Pass for the timers that were asked for. The page said `This exam needs 16 minutes.` The slot was 16 minutes long, starting at the current Hong Kong time. Two students opened the paper 244 seconds apart.

Both timers read `Time remaining 07:59`. The second student did not see four minutes shaved off. Screenshots: `06-part2-slot-first.png`, `06-part2-slot-second.png`.

## Bugs

1. Confirm on a written answer with no mark (`Not graded`, no expected answer stored) shows `Could not save this mark. You may not have permission.` The mark stays unconfirmed. The message reads like a permission failure.
   - Steps: submit a written answer whose question has no expected answer, open the paper in Review, press Confirm on that card.
   - Expected: a clear message that a person must mark it.
   - Actual: `Could not save this mark. You may not have permission.`
   - Screenshot: `/cursor/stores/bc-92314f63-d670-4644-be86-ba5aeb6af75c/media/staging-e2e-part2/06-part2-ungraded-confirm.png`.

2. Confirm all does not say how many answers were skipped. Lane F is not merged, so this is the current behaviour, not a regression from that lane.
   - Steps: on a submitted paper that still has an ungraded answer, press Confirm all.
   - Expected after Lane F: a sentence with the confirmed count and the skipped count.
   - Actual: the button was `Confirm all (2)`, then `Saving…`, and the line under it stayed `2 unconfirmed answers will be confirmed.` No skipped count.
   - Screenshot: `/cursor/stores/bc-92314f63-d670-4644-be86-ba5aeb6af75c/media/staging-e2e-part2/06-part2-confirm-all.png`.
