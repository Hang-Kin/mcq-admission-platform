import assert from "node:assert/strict";
import test from "node:test";

import {
  drawErrorMessage,
  groupDrawPreview,
  sittingButton,
  sittingStatus,
} from "./scheduleModel.ts";

test("a started student locks the sitting even when questions were prepared", () => {
  assert.equal(sittingStatus(false, false), "Not prepared");
  assert.equal(sittingStatus(true, false), "Prepared");
  assert.equal(sittingStatus(true, true), "Locked");
  assert.equal(sittingStatus(false, true), "Locked");
  assert.equal(sittingButton("Not prepared").label, "Prepare questions");
  assert.equal(sittingButton("Prepared").label, "Redraw");
  assert.equal(sittingButton("Prepared").force, true);
  assert.equal(sittingButton("Locked").label, "Locked (students started)");
  assert.equal(sittingButton("Locked").disabled, true);
});

test("preview groups subjects, then numbered topics, then the rest", () => {
  const groups = groupDrawPreview(
    [
      { subject: "Chinese", category: "成語", position: 2, questionText: "Second idiom" },
      { subject: "Chinese", category: "成語", position: 1, questionText: "First idiom" },
      { subject: "Math", category: "Decimals", position: 1, questionText: "Decimal item" },
      { subject: "Math", category: "Fractions", position: 1, questionText: "Fraction item" },
      { subject: "Math", category: "Equations", position: 1, questionText: "Equation item" },
    ],
    [
      { subject: "Math", category: "Fractions", displayOrder: 2 },
      { subject: "Math", category: "Equations", displayOrder: 1 },
    ],
  );

  assert.deepEqual(
    groups.map((group) => group.subject),
    ["Math", "Chinese"],
  );
  assert.deepEqual(
    groups[0]?.topics.map((topic) => topic.name),
    ["Equations", "Fractions", "Decimals"],
  );
  assert.deepEqual(groups[1]?.topics[0]?.questions, ["First idiom", "Second idiom"]);
});

test("prepare errors stay in plain language", () => {
  assert.equal(
    drawErrorMessage("This exam has no subject on its sections."),
    "This exam is not marked as Math or Chinese, so there is nothing to prepare.",
  );
  assert.equal(
    drawErrorMessage("Redraw refused: a student has already started this timeslot."),
    "A student has already started. These questions are locked.",
  );
  assert.equal(
    drawErrorMessage("Fractions: has 1, needs 2; Equations: has 0, needs 2"),
    "Fractions: has 1, needs 2. Equations: has 0, needs 2",
  );
  assert.equal(drawErrorMessage("Math: no topics to draw"), "Math has no topics yet");
  assert.equal(drawErrorMessage("not_staff").includes("section"), false);
});
