import assert from "node:assert/strict";
import test from "node:test";

import { phrase, sameEnglishAgrees } from "./translate.ts";

test("the same English sentence is not given two Chinese translations", () => {
  assert.deepEqual(sameEnglishAgrees(), []);
});

test("dynamic admin sentences round-trip in English and change in Chinese", () => {
  const samples = [
    "Archive Morning? It leaves the active list and can be restored.",
    "This time overlaps Morning and Late morning.",
    "Morning overlaps Overlap.",
    "This will remove 2 students, 5 answers, and 1 result.",
    "Locked because students have started. Frozen at 7 and 8.",
    "Subject settings: Math 8 minutes, Chinese 8 minutes.",
    "Math has no topics yet.",
    "Morning starts tomorrow at 9:00 and the questions are not prepared.",
    "Codes created for 2 of 4 students.",
    "Codes created for 4 students.",
    "2 written answers waiting.",
    "Finalized at 80%.",
    "1/4 correct (25%)",
    "Added Ada Lovelace (0101), 陳大文, 2027 September Entry.",
    "2027 September Entry",
    "2 topics x 2 = 4 questions",
    "Questions per topic must be a whole number greater than 0.",
    "Filled colour is correct. Red is incorrect. Plain is not graded. A ring means confirmed. A bar on the left means overridden.",
  ];
  for (const sample of samples) {
    assert.equal(phrase(sample, "en"), sample, sample);
    assert.notEqual(phrase(sample, "zh-Hant"), sample, sample);
  }
  assert.equal(
    phrase(
      "1 student has already answered this question. Changing the correct answer will not change their results until you choose Regrade.",
      "zh-Hant",
    ),
    "已有 1 名學生回答這題。 更改正確答案不會改變他們的成績，直至你選擇重新評分。",
  );
  assert.equal(
    phrase("Slot 5 overlaps Slot 6 (time clash). Slot 6 (time clash) overlaps Slot 6.", "zh-Hant"),
    "Slot 5 與 Slot 6 (time clash) 重疊。 Slot 6 (time clash) 與 Slot 6 重疊。",
  );
  assert.equal(
    phrase("Locked because students have started. Frozen at 7 and 8.", "zh-Hant"),
    "已有學生開始，因此已鎖定。 已凍結為 7 and 8。",
  );
  assert.equal(phrase("Home", "zh-Hant"), "主頁");
  assert.equal(phrase("提交編號", "zh-Hant"), "提交編號");
  assert.match(phrase("Morning starts tomorrow at 9:00 and the questions are not prepared.", "zh-Hant"), /明日/);
  assert.match(phrase("2026 October Entry", "zh-Hant"), /十月/);
});
