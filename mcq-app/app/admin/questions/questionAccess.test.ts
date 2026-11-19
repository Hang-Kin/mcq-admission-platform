import assert from "node:assert/strict";
import test from "node:test";

import {
  olderQuestionDeleteVisible,
  questionDeleteAllowed,
} from "./questionAccess.ts";

test("teachers and admins see Delete on the older questions pages", () => {
  assert.equal(olderQuestionDeleteVisible("teacher"), true);
  assert.equal(olderQuestionDeleteVisible("admin"), true);
  assert.equal(olderQuestionDeleteVisible("pending"), false);
  assert.equal(olderQuestionDeleteVisible("student"), false);
  assert.equal(olderQuestionDeleteVisible(null), false);
  assert.equal(olderQuestionDeleteVisible(undefined), false);
});

test("deleteQuestion allows a teacher and refuses a pending user", () => {
  assert.equal(questionDeleteAllowed("teacher"), true);
  assert.equal(questionDeleteAllowed("admin"), true);
  assert.equal(questionDeleteAllowed("pending"), false);
  assert.equal(questionDeleteAllowed("student"), false);
  assert.equal(questionDeleteAllowed(null), false);
});
