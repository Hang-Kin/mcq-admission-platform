import assert from "node:assert/strict";
import test from "node:test";

import { navbarSession } from "./nav-session.ts";

test("signed-out navbar shows Sign in and Sign up", () => {
  const session = navbarSession({ authEnabled: true, user: null, staff: false });
  assert.equal(session.email, null);
  assert.equal(session.showSignIn, true);
  assert.equal(session.showSignUp, true);
  assert.equal(session.showLogOut, false);
  assert.equal(session.staff, false);
});

test("signed-in navbar shows the email and Log out", () => {
  const session = navbarSession({
    authEnabled: true,
    user: { email: " admin@school.edu.hk " },
    staff: true,
  });
  assert.equal(session.email, "admin@school.edu.hk");
  assert.equal(session.showSignIn, false);
  assert.equal(session.showSignUp, false);
  assert.equal(session.showLogOut, true);
  assert.equal(session.staff, true);
});

test("a signed-in visitor who is not staff still gets Log out and no sign-in links", () => {
  const session = navbarSession({
    authEnabled: true,
    user: { email: "student@school.edu.hk" },
    staff: false,
  });
  assert.equal(session.email, "student@school.edu.hk");
  assert.equal(session.showSignIn, false);
  assert.equal(session.showSignUp, false);
  assert.equal(session.showLogOut, true);
  assert.equal(session.staff, false);
});

test("a signed-in user with no email still hides Sign in and Sign up", () => {
  const session = navbarSession({
    authEnabled: true,
    user: { email: "  " },
    staff: true,
  });
  assert.equal(session.email, null);
  assert.equal(session.showLogOut, true);
  assert.equal(session.showSignIn, false);
  assert.equal(session.showSignUp, false);
});

test("navbar auth controls stay hidden when sign-in is not configured", () => {
  const session = navbarSession({
    authEnabled: false,
    user: { email: "admin@school.edu.hk" },
    staff: true,
  });
  assert.equal(session.showSignIn, false);
  assert.equal(session.showSignUp, false);
  assert.equal(session.showLogOut, false);
  assert.equal(session.email, null);
  assert.equal(session.staff, false);
});
