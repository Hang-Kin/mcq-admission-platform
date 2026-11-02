import assert from "node:assert/strict";
import test from "node:test";

import { orderByAssigned } from "../exams/gradeScore.ts";
import { assembleReview, reviewVerdict, wrongAnswerHighlighted } from "./marking.ts";

const questions = [
  {
    id: "b",
    questionText: "What is 2/4?",
    category: "Fractions",
    subject: "Math",
    correctAnswer: "1/2",
  },
  {
    id: "a",
    questionText: "成語：一石二鳥",
    category: "成語",
    subject: "Chinese",
    correctAnswer: "甲",
  },
  {
    id: "c",
    questionText: "Write a sentence.",
    category: "Writing",
    subject: "Chinese",
    correctAnswer: null,
  },
];

test("a wrong answer is marked and the correct answer stays on the question", () => {
  const paper = assembleReview(
    ["b", "a", "c", "missing"],
    questions,
    [
      { questionId: "b", studentAnswer: "2/4", isCorrect: false },
      { questionId: "a", studentAnswer: "甲", isCorrect: true },
      { questionId: "c", studentAnswer: "  ", isCorrect: null, needsReview: true },
    ],
  );

  assert.deepEqual(
    paper.map((question) => question.id),
    ["b", "a", "c", "missing"],
  );
  assert.equal(paper[0]?.verdict, "incorrect");
  assert.equal(wrongAnswerHighlighted(paper[0]!.verdict), true);
  assert.equal(paper[0]?.studentAnswer, "2/4");
  assert.equal(paper[0]?.correctAnswer, "1/2");
  assert.equal(paper[0]?.subject, "Math");
  assert.equal(paper[0]?.category, "Fractions");
  assert.equal(paper[1]?.verdict, "correct");
  assert.equal(wrongAnswerHighlighted("correct"), false);
  assert.equal(paper[1]?.correctAnswer, "甲");
  assert.equal(paper[2]?.verdict, "not-graded");
  assert.equal(paper[2]?.studentAnswer, "");
  assert.equal(paper[2]?.needsReview, true);
  assert.equal(paper[2]?.correctAnswer, "");
  assert.equal(paper[3]?.verdict, "incorrect");
  assert.equal(paper[3]?.questionText, "Unknown question");
  assert.deepEqual(paper.map((question) => question.number), [1, 2, 3, 4]);
});

test("question order matches the grade page", () => {
  const paper = assembleReview(["b", "a"], questions, []);
  const ordered = orderByAssigned(
    [
      { question_id: "a", category: "成語", question_text: "成語：一石二鳥" },
      { question_id: "b", category: "Fractions", question_text: "What is 2/4?" },
    ],
    ["b", "a"],
  );
  assert.deepEqual(
    paper.map((question) => question.id),
    ordered.map((question) => question.question_id),
  );
});

test("verdict follows the saved mark, and a missing answer is incorrect", () => {
  assert.equal(reviewVerdict({ hasResponse: false, isCorrect: null }), "incorrect");
  assert.equal(reviewVerdict({ hasResponse: true, isCorrect: null }), "not-graded");
  assert.equal(reviewVerdict({ hasResponse: true, isCorrect: false }), "incorrect");
  assert.equal(reviewVerdict({ hasResponse: true, isCorrect: true }), "correct");
});
