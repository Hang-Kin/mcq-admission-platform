import assert from "node:assert/strict";
import test from "node:test";

import { olderQuestionDeleteVisible } from "./questionAccess.ts";

test("teachers and admins see Delete on the older questions pages", () => {
  assert.equal(olderQuestionDeleteVisible("teacher"), true);
  assert.equal(olderQuestionDeleteVisible("admin"), true);
  assert.equal(olderQuestionDeleteVisible("pending"), false);
  assert.equal(olderQuestionDeleteVisible("student"), false);
  assert.equal(olderQuestionDeleteVisible(null), false);
  assert.equal(olderQuestionDeleteVisible(undefined), false);
});
