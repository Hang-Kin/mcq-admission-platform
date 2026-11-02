import assert from "node:assert/strict";
import test from "node:test";

import { formatHongKongDateTime } from "../../../lib/hongKongTime.ts";
import { scoreResponses } from "../exams/gradeScore.ts";
import { orderByAssigned } from "../exams/gradeScore.ts";
import { buildResultRow } from "./columns.ts";
import { teacherStateLabel } from "./labels.ts";
import {
  assembleReview,
  confirmAllCount,
  railCellClass,
  reviewVerdict,
  scoreRow,
  wrongAnswerHighlighted,
} from "./marking.ts";

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

test("the question rail is rectangular and light green when the final mark is correct", () => {
  const correct = railCellClass("correct", "unconfirmed");
  assert.match(correct, /rounded-none/);
  assert.match(correct, /bg-green-100/);
  assert.equal(correct.includes("bg-primary"), false);
  assert.match(railCellClass("incorrect", "unconfirmed"), /bg-destructive/);
  assert.match(railCellClass("not-graded", "unconfirmed"), /bg-muted/);
  assert.match(railCellClass("correct", "confirmed"), /ring-2/);
  assert.match(railCellClass("incorrect", "overridden"), /border-l-4/);
});

test("confirm all counts only stored answers that are still unconfirmed", () => {
  assert.equal(
    confirmAllCount([
      { state: "unconfirmed", responseId: "a" },
      { state: "confirmed", responseId: "b" },
      { state: "overridden", responseId: "c" },
      { state: "unconfirmed", responseId: null },
    ]),
    1,
  );
});

test("an override beats the system mark in the total and the export row", () => {
  const mark = {
    state: "overridden" as const,
    snapshotKnown: true,
    snapshot: false,
    overrideIsCorrect: true,
    note: "working shown",
    markedByLabel: "teacher@school.edu",
    markedAt: "2026-06-01T01:12:05.000Z",
  };
  const paper = assembleReview(
    ["q"],
    [
      {
        id: "q",
        questionText: "2 + 2",
        category: "Numbers",
        subject: "Math",
        correctAnswer: "4",
      },
    ],
    [
      {
        questionId: "q",
        responseId: "r",
        studentAnswer: "4",
        isCorrect: false,
        mark,
      },
    ],
  );
  assert.equal(paper[0]?.verdict, "correct");
  assert.equal(paper[0]?.systemVerdict, "incorrect");
  assert.equal(paper[0]?.systemKnown, true);
  assert.equal(paper[0]?.finalCorrect, true);
  assert.equal(paper[0]?.teacherState, "overridden");
  assert.equal(
    teacherStateLabel({
      state: "overridden",
      who: mark.markedByLabel,
      when: formatHongKongDateTime(mark.markedAt),
    }),
    "Overridden by teacher@school.edu · 1 Jun 2026, 09:12 HKT",
  );

  const scored = scoreRow({
    is_correct: false,
    needs_review: true,
    response_marks: {
      state: "overridden",
      override_is_correct: true,
      system_is_correct: false,
      system_mark_known: true,
    },
  });
  assert.equal(scored.is_correct, true);
  assert.equal(scored.needs_review, false);
  const score = scoreResponses([{ is_correct: scored.is_correct }], 2);
  assert.equal(score.correct, 1);
  assert.equal(score.percent, 50);

  const row = buildResultRow({
    submissionCode: "0101",
    englishName: "Ada Wong",
    chineseName: "",
    intake: "2026-10",
    slot: "Morning",
    startedAt: null,
    submittedAt: null,
    assigned: [
      { id: "q", subject: "Math", category: "Numbers" },
      { id: "other", subject: "Chinese", category: "成語" },
    ],
    responses: [{ questionId: "q", isCorrect: scored.is_correct }],
  });
  assert.equal(row.total, 1);
  assert.equal(row.mathScore, 1);
  assert.equal(row.percentage, 50);
});

test("a legacy override with no saved system mark does not pretend the system mark is known", () => {
  const paper = assembleReview(
    ["q"],
    [
      {
        id: "q",
        questionText: "Write a sentence.",
        category: "Writing",
        subject: "Chinese",
        correctAnswer: null,
      },
    ],
    [
      {
        questionId: "q",
        responseId: "r",
        studentAnswer: "hello",
        isCorrect: true,
        needsReview: true,
        mark: {
          state: "overridden",
          snapshotKnown: false,
          snapshot: null,
          overrideIsCorrect: false,
          note: null,
          markedByLabel: null,
          markedAt: null,
        },
      },
    ],
  );
  assert.equal(paper[0]?.systemKnown, false);
  assert.equal(paper[0]?.finalCorrect, false);
  assert.equal(paper[0]?.verdict, "incorrect");
  assert.equal(paper[0]?.needsReview, false);
  assert.equal(
    teacherStateLabel({ state: "unconfirmed", who: null, when: "" }),
    "Unconfirmed",
  );
});
