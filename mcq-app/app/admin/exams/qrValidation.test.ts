import assert from "node:assert/strict";
import test from "node:test";

import { validateGeneratePicker } from "./qrValidation.ts";

const base = {
  studentIds: ["student-1"],
  questionSetNames: ["General"],
  questionCount: 5,
  availableQuestionCount: 10,
};

test("a non-sectioned exam still requires a question set and count", () => {
  assert.equal(
    validateGeneratePicker({ ...base, questionSetNames: [] }).ok,
    false,
  );
  assert.equal(validateGeneratePicker({ ...base, questionCount: 0 }).ok, false);
  assert.equal(validateGeneratePicker(base).ok, true);
});

test("a sectioned exam does not use the question draw", () => {
  assert.equal(
    validateGeneratePicker({
      ...base,
      questionSetNames: [],
      questionCount: 0,
      availableQuestionCount: 0,
      usesSections: true,
    }).ok,
    true,
  );
  assert.equal(
    validateGeneratePicker({ ...base, studentIds: [], usesSections: true }).ok,
    false,
  );
});
