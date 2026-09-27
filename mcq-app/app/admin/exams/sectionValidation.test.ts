import assert from "node:assert/strict";
import test from "node:test";

import {
  compactedPositions,
  deletionBlockMessage,
  nextSectionPosition,
  positionsAreContiguous,
  swapWithNeighbor,
  validateSectionFields,
} from "./sectionValidation.ts";

test("requires label, question set, and duration", () => {
  const result = validateSectionFields({
    label: "  ",
    questionSet: "General",
    durationMinutes: "20",
  });
  assert.equal(result.ok, false);
});

test("rejects a fractional duration", () => {
  const result = validateSectionFields({
    label: "Section A",
    questionSet: "Algebra",
    durationMinutes: "10.5",
  });
  assert.equal(result.ok, false);
});

test("accepts a positive whole-minute duration", () => {
  const result = validateSectionFields({
    label: " Section A ",
    questionSet: " Algebra ",
    durationMinutes: "15",
  });
  assert.deepEqual(result, {
    ok: true,
    payload: {
      label: "Section A",
      question_set: "Algebra",
      duration_minutes: 15,
    },
  });
});

test("first section is position 0 and later sections append", () => {
  assert.equal(nextSectionPosition([]), 0);
  assert.equal(nextSectionPosition([0, 2]), 3);
});

test("deletion is allowed when nobody has started", () => {
  assert.equal(deletionBlockMessage(0), null);
});

test("deletion is blocked once any student has started", () => {
  assert.match(deletionBlockMessage(1) ?? "", /already started/);
});

test("positions must be a contiguous 0-based sequence", () => {
  assert.equal(positionsAreContiguous([]), true);
  assert.equal(positionsAreContiguous([0, 1, 2]), true);
  assert.equal(positionsAreContiguous([0, 2]), false);
});

test("move swaps position with the visual neighbor", () => {
  const sections = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
    { id: "c", position: 2 },
  ];
  assert.deepEqual(swapWithNeighbor(sections, "b", "up"), {
    ok: true,
    updates: [
      { id: "b", position: 0 },
      { id: "a", position: 1 },
    ],
  });
  assert.equal(swapWithNeighbor(sections, "a", "up").ok, false);
  assert.equal(swapWithNeighbor(sections, "c", "down").ok, false);
});

test("delete closes the position gap", () => {
  assert.deepEqual(
    compactedPositions([
      { id: "a", position: 0 },
      { id: "c", position: 2 },
    ]),
    [{ id: "c", position: 1 }],
  );
});
