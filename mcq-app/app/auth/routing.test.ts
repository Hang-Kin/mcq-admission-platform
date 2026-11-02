import assert from "node:assert/strict";
import test from "node:test";

import { isStaffRole } from "../../lib/staffRole.ts";

import {
  NON_STAFF_PATH,
  SIGN_IN_PATH,
  STAFF_HOME_PATH,
  postSignInPath,
  protectedRedirectTarget,
} from "./routing.ts";

const roles = ["admin", "teacher", "pending", "student", "", "Admin", null, undefined];

test("sign-in sends only admin and teacher to /admin", () => {
  for (const role of roles) {
    assert.equal(postSignInPath(role) === STAFF_HOME_PATH, isStaffRole(role));
    if (isStaffRole(role)) {
      assert.equal(postSignInPath(role), "/admin");
    } else {
      assert.equal(postSignInPath(role), NON_STAFF_PATH);
    }
  }
});

test("protected redirects by role and does not loop non-staff through /admin", () => {
  for (const role of roles) {
    assert.equal(
      protectedRedirectTarget({ signedIn: true, role }) === STAFF_HOME_PATH,
      isStaffRole(role),
    );
    if (!isStaffRole(role)) {
      assert.equal(protectedRedirectTarget({ signedIn: true, role }), null);
    }
  }
  assert.equal(protectedRedirectTarget({ signedIn: true, role: "admin" }), "/admin");
  assert.equal(protectedRedirectTarget({ signedIn: true, role: "teacher" }), "/admin");
});

test("protected sends signed-out visitors to sign-in", () => {
  assert.equal(protectedRedirectTarget({ signedIn: false, role: null }), SIGN_IN_PATH);
  assert.equal(protectedRedirectTarget({ signedIn: false, role: "admin" }), SIGN_IN_PATH);
  assert.equal(SIGN_IN_PATH, "/auth/login");
});
