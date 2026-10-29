import assert from "node:assert/strict";
import test from "node:test";

import { composeIntake, formatIntakeLabel, INTAKE_RE } from "./intakeLabel.ts";

test("2026-10 is shown as 2026 October Entry", () => {
  assert.equal(formatIntakeLabel("2026-10"), "2026 October Entry");
  assert.equal(INTAKE_RE.test("2026-10"), true);
});

test("2027-09 is shown as 2027 September Entry", () => {
  assert.equal(formatIntakeLabel("2027-09"), "2027 September Entry");
});

test("a month outside 01-12 is rejected", () => {
  assert.equal(formatIntakeLabel("2026-00"), null);
  assert.equal(formatIntakeLabel("2026-13"), null);
  assert.equal(composeIntake("2026", "13"), null);
  assert.equal(composeIntake("2026", "10"), "2026-10");
});
