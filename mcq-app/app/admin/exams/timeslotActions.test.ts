import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("old timeslot actions cannot save a chosen question set or manual override", () => {
  const source = readFileSync(new URL("./[examId]/timeslots/actions.ts", import.meta.url), "utf8");
  assert.equal(source.includes("function createTimeslot"), false);
  assert.equal(source.includes("function updateTimeslot"), false);
  assert.equal(source.includes("setTimeslotOverride"), false);
  assert.equal(source.includes("saveSectionTimeslotQuestionSets"), false);
  assert.equal(source.includes("question_set"), false);
  assert.equal(source.includes("active_timeslot_override: override"), false);
});
