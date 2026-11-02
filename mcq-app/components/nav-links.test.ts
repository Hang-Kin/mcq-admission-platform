import assert from "node:assert/strict";
import test from "node:test";

import { isHrefActive, isNavActive, staffNavLinks, type NavLink } from "./nav-links.ts";

const home: NavLink = { href: "/admin", label: "Home", exact: true };
const questions: NavLink = { href: "/admin/bank", label: "Questions" };
const sittings: NavLink = { href: "/admin/schedule", label: "Sittings" };
const students: NavLink = { href: "/admin/students", label: "Students" };
const results: NavLink = { href: "/admin/review", label: "Results", matchGrades: true };

test("staff nav keeps Home, Questions, Sittings, Students, and Results", () => {
  assert.deepEqual(
    staffNavLinks.map((link) => link.label),
    ["Home", "Questions", "Sittings", "Students", "Results"],
  );
  assert.equal(staffNavLinks[0]?.exact, true);
  assert.equal(staffNavLinks[4]?.matchGrades, true);
});

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

test("questions stays active on subject settings", () => {
  const questionsLink = staffNavLinks[1];
  assert.equal(questionsLink?.label, "Questions");
  assert.equal(questionsLink ? isNavActive("/admin/settings", questionsLink) : false, true);
  assert.equal(isNavActive("/admin/settings", home), false);
  assert.equal(questionsLink ? isNavActive("/admin/bank/Math", questionsLink) : false, true);
  assert.equal(questionsLink ? isNavActive("/admin/bank/Chinese", questionsLink) : false, true);
});

test("a hash link is current only when that hash is open", () => {
  assert.equal(isHrefActive("/admin/schedule", "/admin/schedule", ""), true);
  assert.equal(isHrefActive("/admin/schedule", "/admin/schedule#codes", ""), false);
  assert.equal(isHrefActive("/admin/schedule", "/admin/schedule", "#codes"), false);
  assert.equal(isHrefActive("/admin/schedule", "/admin/schedule#codes", "#codes"), true);
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
