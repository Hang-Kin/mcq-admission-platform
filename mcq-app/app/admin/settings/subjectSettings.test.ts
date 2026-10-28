import assert from "node:assert/strict";
import test from "node:test";

import {
  countRealTopics,
  parsePositiveInteger,
  questionTotal,
} from "./subjectSettings.ts";

test("the total line multiplies topics by questions per topic", () => {
  assert.equal(questionTotal(6, 2), "6 topics x 2 = 12 questions");
  assert.equal(questionTotal(4, 2), "4 topics x 2 = 8 questions");
  assert.equal(questionTotal(4, 3), "4 topics x 3 = 12 questions");
  assert.equal(questionTotal(1, 2), "1 topic x 2 = 2 questions");
  assert.equal(questionTotal(0, 2), "0 topics x 2 = 0 questions");
});

test("only real topics are counted", () => {
  assert.equal(
    countRealTopics(["Math", "math", "Chinese", "Fractions", "Fractions", "Decimals", " "]),
    2,
  );
  assert.equal(countRealTopics([]), 0);
});

test("questions per topic and minutes must be whole numbers above zero", () => {
  assert.equal(parsePositiveInteger("2", "Math questions per topic").ok, true);
  assert.equal(parsePositiveInteger("0", "Math time").ok, false);
  assert.equal(parsePositiveInteger("1.5", "Chinese time").ok, false);
  assert.equal(parsePositiveInteger("", "Chinese questions per topic").ok, false);
  const parsed = parsePositiveInteger("8", "Chinese time");
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value, 8);
});
