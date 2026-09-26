import assert from "node:assert/strict";
import test from "node:test";

import {
  assignedCountOf,
  isGradeStale,
  orderByAssigned,
  scoreResponses,
} from "./gradeScore.ts";

test("percent is correct over all responses, one decimal", () => {
  const responses = [
    ...Array.from({ length: 14 }, () => ({ is_correct: true })),
    ...Array.from({ length: 7 }, () => ({ is_correct: false })),
  ];
  assert.deepEqual(scoreResponses(responses), {
    correct: 14,
    total: 21,
    pendingReview: 0,
    percent: 66.7,
  });
});

test("null is_correct counts as not correct; pending review is counted", () => {
  const score = scoreResponses([
    { is_correct: true, needs_review: false },
    { is_correct: null, needs_review: true },
  ]);
  assert.equal(score.correct, 1);
  assert.equal(score.total, 2);
  assert.equal(score.pendingReview, 1);
  assert.equal(score.percent, 50);
});

test("unanswered assigned questions count as incorrect in the denominator", () => {
  const score = scoreResponses([{ is_correct: true }], 21);
  assert.equal(score.correct, 1);
  assert.equal(score.total, 21);
  assert.equal(score.percent, 4.8);
});

test("no answers out of assigned questions scores zero", () => {
  const score = scoreResponses([], 5);
  assert.equal(score.total, 5);
  assert.equal(score.percent, 0);
});

test("pending review still counts only existing response rows", () => {
  const score = scoreResponses(
    [
      { is_correct: null, needs_review: true },
      { is_correct: true, needs_review: false },
    ],
    10,
  );
  assert.equal(score.pendingReview, 1);
  assert.equal(score.percent, 10);
});

test("falls back to response count without assigned ids", () => {
  assert.equal(assignedCountOf(null), undefined);
  assert.equal(assignedCountOf(["a", "b"]), 2);
  assert.equal(scoreResponses([{ is_correct: true }], undefined).percent, 100);
});

test("no responses and no assigned questions has no percent", () => {
  assert.equal(scoreResponses([]).percent, null);
});

test("stale when stored grade differs from live score", () => {
  const score = scoreResponses([{ is_correct: true }, { is_correct: false }]);
  assert.equal(isGradeStale(null, score), false);
  assert.equal(isGradeStale("50.0", score), false);
  assert.equal(isGradeStale(100, score), true);
});

test("orders by assigned ids, then category and text", () => {
  const rows = [
    { question_id: "x", category: "B", question_text: "b" },
    { question_id: "q2", category: "A", question_text: "a" },
    { question_id: "y", category: "A", question_text: "z" },
    { question_id: "q1", category: "Z", question_text: "z" },
  ];
  assert.deepEqual(
    orderByAssigned(rows, ["q1", "q2"]).map((r) => r.question_id),
    ["q1", "q2", "y", "x"],
  );
});
