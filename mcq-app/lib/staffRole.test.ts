import assert from "node:assert/strict";
import test from "node:test";

import { isStaffRole } from "./staffRole.ts";

test("admin and teacher match is_staff", () => {
  assert.equal(isStaffRole("admin"), true);
  assert.equal(isStaffRole("teacher"), true);
});

test("pending, signed-out, and unknown roles are not staff", () => {
  assert.equal(isStaffRole("pending"), false);
  assert.equal(isStaffRole(""), false);
  assert.equal(isStaffRole(null), false);
  assert.equal(isStaffRole(undefined), false);
  assert.equal(isStaffRole("Admin"), false);
});
