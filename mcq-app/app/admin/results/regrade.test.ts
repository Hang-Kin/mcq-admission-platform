import assert from "node:assert/strict";
import test from "node:test";

import { answeredWarning } from "./labels.ts";
import { countStudents, previewRegrade, regradeUpdates, systemMark } from "./regrade.ts";

test("stored marks follow the same comparison as submit, and are not live", () => {
  assert.equal(systemMark({ type: "numeric", studentAnswer: "6", correctAnswer: "6.0" }), true);
  assert.equal(systemMark({ type: "numeric", studentAnswer: " ", correctAnswer: "6" }), false);
  assert.equal(systemMark({ type: "numeric", studentAnswer: "nope", correctAnswer: "6" }), false);
  assert.equal(systemMark({ type: "numeric", studentAnswer: null, correctAnswer: "6" }), null);
  assert.equal(systemMark({ type: "numeric", studentAnswer: "6", correctAnswer: null }), null);
  assert.equal(systemMark({ type: "fraction", studentAnswer: "2/4", correctAnswer: "1/2" }), false);
  assert.equal(systemMark({ type: "fraction", studentAnswer: "2/4", correctAnswer: "2/4" }), true);
  assert.equal(systemMark({ type: "radio", studentAnswer: " Yes ", correctAnswer: "yes" }), true);
  assert.equal(systemMark({ type: "text", studentAnswer: "Hello", correctAnswer: " hello " }), true);
});

test("regrade preview counts students and keeps overrides", () => {
  const preview = previewRegrade({
    type: "numeric",
    correctAnswer: "6",
    rows: [
      {
        responseId: "r1",
        studentId: "s1",
        studentLabel: "Ada (0101)",
        studentAnswer: "6.0",
        systemIsCorrect: false,
        overridden: false,
      },
      {
        responseId: "r2",
        studentId: "s1",
        studentLabel: "Ada (0101)",
        studentAnswer: "5",
        systemIsCorrect: true,
        overridden: false,
      },
      {
        responseId: "r3",
        studentId: "s2",
        studentLabel: "Ben (0102)",
        studentAnswer: "6",
        systemIsCorrect: false,
        overridden: true,
      },
      {
        responseId: "r4",
        studentId: "s3",
        studentLabel: "Cara (0103)",
        studentAnswer: "6",
        systemIsCorrect: true,
        overridden: false,
      },
      {
        responseId: "r5",
        studentId: "s4",
        studentLabel: "Dan (0104)",
        studentAnswer: "7",
        systemIsCorrect: null,
        overridden: false,
      },
    ],
  });

  assert.equal(preview.preservedOverrides, 1);
  assert.equal(preview.students, 2);
  assert.deepEqual(
    preview.changes.map((change) => [change.responseId, change.from, change.to]),
    [
      ["r1", false, true],
      ["r2", true, false],
      ["r5", null, false],
    ],
  );
  assert.equal(
    preview.changes.some((change) => change.responseId === "r3"),
    false,
  );
  assert.equal(
    preview.changes.some((change) => change.responseId === "r4"),
    false,
  );
  assert.deepEqual(regradeUpdates(preview), [
    { id: "r1", is_correct: true },
    { id: "r2", is_correct: false },
    { id: "r5", is_correct: false },
  ]);
});

test("the edit warning counts each student once", () => {
  assert.equal(countStudents(["s1", "s1", "s2", "", null]), 2);
  assert.equal(countStudents([]), 0);
});

test("the edit screen warns that past results stay until regrade", () => {
  assert.equal(answeredWarning(0), null);
  assert.equal(
    answeredWarning(1),
    "1 student has already answered this question. Changing the correct answer will not change their results until you choose Regrade.",
  );
  assert.equal(
    answeredWarning(4),
    "4 students have already answered this question. Changing the correct answer will not change their results until you choose Regrade.",
  );
});
