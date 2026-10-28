import assert from "node:assert/strict";
import test from "node:test";

import { isNavActive, type NavLink } from "./nav-links.ts";

const home: NavLink = { href: "/admin", label: "Home", exact: true };
const questions: NavLink = { href: "/admin/bank", label: "Questions" };
const sittings: NavLink = { href: "/admin/schedule", label: "Sittings" };
const students: NavLink = { href: "/admin/students", label: "Students" };
const results: NavLink = { href: "/admin/review", label: "Results", matchGrades: true };

test("home is only the checklist, not every admin page", () => {
  assert.equal(isNavActive("/admin", home), true);
  assert.equal(isNavActive("/admin/bank", home), false);
  assert.equal(isNavActive("/admin/schedule", home), false);
  assert.equal(isNavActive("/", home), false);
});

test("questions, sittings, and students follow their own paths", () => {
  assert.equal(isNavActive("/admin/bank", questions), true);
  assert.equal(isNavActive("/admin/bank/Math", questions), true);
  assert.equal(isNavActive("/admin/questions", questions), false);
  assert.equal(isNavActive("/admin/schedule", sittings), true);
  assert.equal(isNavActive("/admin/students", students), true);
  assert.equal(isNavActive("/admin/students/new", students), true);
});

test("results stays active on the review queue and on a grade page", () => {
  assert.equal(isNavActive("/admin/review", results), true);
  assert.equal(
    isNavActive("/admin/exams/exam-1/grades", results),
    true,
  );
  assert.equal(
    isNavActive("/admin/exams/exam-1/grades/instance-1", results),
    true,
  );
  assert.equal(isNavActive("/admin/exams/exam-1/qr", results), false);
  assert.equal(isNavActive("/admin/exams", results), false);
});
