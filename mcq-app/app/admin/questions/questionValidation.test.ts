import assert from "node:assert/strict";
import test from "node:test";

import { publicQuestionImagePath } from "./questionImages.ts";
import { summarizeQuestionSets } from "./questionSets.ts";
import { validateQuestionRow } from "./questionValidation.ts";

test("radio question requires a set, four choices, and one correct answer", () => {
  const result = validateQuestionRow({
    question_text: "Solve the figure",
    category: "Math",
    type: "radio",
    options: ["1", "2", "3", "4"],
    correct_answer: "2",
    question_set: "Set A",
    requireQuestionSet: true,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.payload.options, ["1", "2", "3", "4"]);
  assert.equal(result.payload.correct_answer, "2");
  assert.equal(result.payload.question_set, "Set A");
});

test("new question set name is the trimmed tag", () => {
  const result = validateQuestionRow({
    question_text: "Caption",
    category: "Math",
    type: "text",
    options: null,
    correct_answer: "",
    question_set: "  Week 2  ",
    requireQuestionSet: true,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.payload.question_set, "Week 2");
  assert.equal(result.payload.correct_answer, null);
});

test("authoring form rejects a blank question set", () => {
  const result = validateQuestionRow({
    question_text: "Caption",
    category: "Math",
    type: "text",
    options: null,
    correct_answer: "",
    question_set: "  ",
    requireQuestionSet: true,
  });

  assert.equal(result.ok, false);
});

test("csv import can still omit the question set", () => {
  const result = validateQuestionRow({
    question_text: "What is 2+2?",
    category: "Math",
    type: "numeric",
    options: null,
    correct_answer: "4",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.payload.question_set, null);
});

test("set summary keeps questions with no tag visible", () => {
  const summaries = summarizeQuestionSets([
    "Set 1",
    "Set 1",
    "General",
    null,
    "  ",
    "General",
  ]);

  assert.deepEqual(summaries, [
    { name: "General", count: 2 },
    { name: "Set 1", count: 2 },
    { name: null, count: 2 },
  ]);
});

test("session images only render public question-images urls", () => {
  assert.equal(
    publicQuestionImagePath(
      "https://example.supabase.co/storage/v1/object/public/question-images/abc.jpg",
    ),
    "abc.jpg",
  );
  assert.equal(publicQuestionImagePath("https://evil.example/abc.jpg"), null);
  assert.equal(publicQuestionImagePath("javascript:alert(1)"), null);
});
