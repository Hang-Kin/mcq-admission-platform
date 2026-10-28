import assert from "node:assert/strict";
import test from "node:test";

import { validateBankQuestion } from "./bankValidation.ts";
import { fractionCheck } from "./fraction.ts";
import { isRealTopic, validateTopicName } from "./subjects.ts";
import { summarizeTopics, topicCountText, unfiledCount } from "./topicOrder.ts";

test("1/3 is simplified and 2/6 is not", () => {
  const simplified = fractionCheck("1", "3");
  assert.equal(simplified.kind, "simplified");
  if (simplified.kind === "simplified") assert.equal(simplified.canonical, "1/3");

  const unsimplified = fractionCheck("2", "6");
  assert.equal(unsimplified.kind, "not-simplified");
  if (unsimplified.kind === "not-simplified") {
    assert.equal(unsimplified.canonical, "1/3");
    assert.match(unsimplified.message, /1\/3/);
  }

  const whole = fractionCheck("2", "1");
  assert.equal(whole.kind, "simplified");
  if (whole.kind === "simplified") assert.equal(whole.canonical, "2/1");

  const negative = fractionCheck("-2", "4");
  assert.equal(negative.kind, "not-simplified");
  if (negative.kind === "not-simplified") assert.equal(negative.canonical, "-1/2");

  assert.equal(fractionCheck("1", "0").kind, "invalid");
  assert.equal(fractionCheck("-0", "1").kind, "invalid");
  assert.equal(fractionCheck("", "").kind, "empty");
});

test("a fraction question stores the simplified a/b", () => {
  const saved = validateBankQuestion({
    subject: "Math",
    category: "Fractions",
    questionText: "Simplify",
    kind: "fraction",
    options: null,
    correctAnswer: "",
    fractionA: "1",
    fractionB: "3",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.payload.type, "fraction");
  assert.equal(saved.payload.correct_answer, "1/3");
  assert.equal(saved.payload.options, null);

  const rejected = validateBankQuestion({
    subject: "Math",
    category: "Fractions",
    questionText: "Simplify",
    kind: "fraction",
    options: null,
    correctAnswer: "2/6",
    fractionA: "2",
    fractionB: "6",
  });
  assert.equal(rejected.ok, false);
});

test("a choice needs two options and one marked correct", () => {
  const missing = validateBankQuestion({
    subject: "Chinese",
    category: "成語",
    questionText: "Pick one",
    kind: "choice",
    options: ["only"],
    correctAnswer: "only",
    fractionA: "",
    fractionB: "",
  });
  assert.equal(missing.ok, false);

  const saved = validateBankQuestion({
    subject: "Chinese",
    category: "成語",
    questionText: "Pick one",
    kind: "choice",
    options: [" 甲 ", "乙"],
    correctAnswer: "甲",
    fractionA: "",
    fractionB: "",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.payload.type, "radio");
  assert.deepEqual(saved.payload.options, ["甲", "乙"]);
  assert.equal(saved.payload.correct_answer, "甲");
});

test("an older question can keep the subject word as its category", () => {
  const saved = validateBankQuestion({
    subject: "Math",
    category: "Math",
    allowLegacyCategory: true,
    questionText: "Legacy item",
    kind: "number",
    options: null,
    correctAnswer: "4",
    fractionA: "",
    fractionB: "",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.payload.category, "Math");
  assert.equal(saved.payload.subject, "Math");
});

test("a number answer is a plain number", () => {
  const saved = validateBankQuestion({
    subject: "Math",
    category: "Decimals",
    questionText: "What is 0.5 + 0.5?",
    kind: "number",
    options: null,
    correctAnswer: "1",
    fractionA: "",
    fractionB: "",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.payload.type, "numeric");
  assert.equal(saved.payload.correct_answer, "1");

  const rejected = validateBankQuestion({
    subject: "Math",
    category: "Decimals",
    questionText: "What is 0.5 + 0.5?",
    kind: "number",
    options: null,
    correctAnswer: "1/2",
    fractionA: "",
    fractionB: "",
  });
  assert.equal(rejected.ok, false);
});

test("subject words are not topics, and numbered topics come first", () => {
  assert.equal(isRealTopic("Math"), false);
  assert.equal(isRealTopic(" math "), false);
  assert.equal(isRealTopic("Chinese"), false);
  assert.equal(isRealTopic("Fractions"), true);
  assert.equal(validateTopicName("Math").ok, false);

  const topics = summarizeTopics(
    ["Math", "math", "Decimals", "Fractions", "Equations", "Algebra", "Fractions"],
    [
      { category: "Fractions", display_order: 2 },
      { category: "Equations", display_order: 1 },
    ],
    2,
  );

  assert.deepEqual(
    topics.map((topic) => topic.name),
    ["Equations", "Fractions", "Algebra", "Decimals"],
  );
  assert.equal(topics.find((topic) => topic.name === "Fractions")?.count, 2);
  assert.equal(topics.find((topic) => topic.name === "Fractions")?.short, false);
  assert.equal(topics.find((topic) => topic.name === "Algebra")?.short, true);
  assert.equal(topicCountText(1, 2), "1 of 2 questions");
  assert.equal(topicCountText(2, 2), "2 questions");
  assert.equal(unfiledCount(["Math", "math", "  ", "Fractions"]), 3);
});

test("topics with no order row stay alphabetical after numbered ones", () => {
  const topics = summarizeTopics(
    ["成語", "修辭", "文言字詞"],
    [{ category: "修辭", display_order: 1 }],
    2,
  );
  assert.equal(topics[0]?.name, "修辭");
  assert.deepEqual(topics.slice(1).map((topic) => topic.name), ["成語", "文言字詞"].sort((a, b) => a.localeCompare(b, "zh")));
});
