import assert from "node:assert/strict";
import test from "node:test";

import { validateExamFields } from "./examValidation.ts";

test("requires a name", () => {
  const result = validateExamFields({
    name: "   ",
    durationMinutes: "60",
  });
  assert.equal(result.ok, false);
});

test("accepts any non-empty name without a format or uniqueness check", () => {
  const result = validateExamFields({
    name: "  2026 P6 / transfer  ",
    durationMinutes: "90",
  });
  assert.deepEqual(result, {
    ok: true,
    payload: { name: "2026 P6 / transfer", duration_minutes: 90 },
  });
});

test("requires a duration", () => {
  const result = validateExamFields({
    name: "Sample Admission Test",
    durationMinutes: "  ",
  });
  assert.equal(result.ok, false);
});

test("rejects zero, fractions, and non-numeric durations", () => {
  for (const durationMinutes of ["0", "10.5", "-5", "1e2", "abc"]) {
    const result = validateExamFields({
      name: "Sample Admission Test",
      durationMinutes,
    });
    assert.equal(result.ok, false, durationMinutes);
  }
});

test("accepts a positive whole-minute duration", () => {
  const result = validateExamFields({
    name: "Sample Admission Test",
    durationMinutes: " 45 ",
  });
  assert.deepEqual(result, {
    ok: true,
    payload: { name: "Sample Admission Test", duration_minutes: 45 },
  });
});

test("rejects a duration above the integer column", () => {
  const result = validateExamFields({
    name: "Sample Admission Test",
    durationMinutes: "2147483648",
  });
  assert.equal(result.ok, false);
});
