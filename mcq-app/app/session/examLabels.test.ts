import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVANCE_FAILED_MESSAGE,
  examLabels,
  examLabelsZh,
  FRACTION_BLANK_MESSAGE,
  questionProgressCopy,
  questionProgressLabel,
  translateExamText,
  unansweredCountLabel,
} from "./[token]/labels.js";

test("english exam copy stays the default", () => {
  assert.equal(examLabels.previous, "Previous");
  assert.equal(examLabels.next, "Next");
  assert.equal(examLabels.submitExam, "Submit exam");
  assert.equal(examLabels.cancel, "Cancel");
  assert.equal(questionProgressLabel(2, 10), "Question 2 of 10");
  assert.equal(unansweredCountLabel(1), "1 question is not answered");
  assert.equal(unansweredCountLabel(2), "2 questions are not answered");
});

test("traditional chinese sits behind the language setting", () => {
  assert.equal(examLabelsZh.previous, "上一題");
  assert.equal(examLabelsZh.submitExam, "交卷");
  assert.equal(questionProgressCopy(2, 10).zh, "第 2 題，共 10 題");
  assert.equal(translateExamText(FRACTION_BLANK_MESSAGE), "兩個空格都要填整數。");
  assert.equal(translateExamText(ADVANCE_FAILED_MESSAGE), examLabelsZh.advanceFailed);
  assert.equal(translateExamText("Saved"), "已儲存");
  assert.equal(translateExamText("--:--"), "--:--");
  assert.equal(translateExamText("not a label"), "not a label");
  for (const key of Object.keys(examLabels.errors) as Array<keyof typeof examLabels.errors>) {
    const english = examLabels.errors[key];
    const chinese = examLabelsZh.errors[key];
    assert.notEqual(chinese.title, english.title, key);
    if (english.body) assert.notEqual(chinese.body, english.body, key);
    else assert.equal(chinese.body, "");
  }
});
