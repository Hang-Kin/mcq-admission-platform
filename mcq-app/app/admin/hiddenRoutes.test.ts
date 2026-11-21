import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isHiddenAdminRoute } from "./hiddenRoutes.ts";

const adminRoot = path.dirname(fileURLToPath(import.meta.url));

test("exact hidden routes match, including a trailing slash", () => {
  assert.equal(isHiddenAdminRoute("/admin/advanced"), true);
  assert.equal(isHiddenAdminRoute("/admin/advanced/"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/new"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/new/"), true);
});

test("a hidden route covers a nested path, a query string, and a hash", () => {
  assert.equal(isHiddenAdminRoute("/admin/advanced/extra"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/new?name=Math"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams#list"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/?tab=1"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/exam-1/qr"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/exam-1/qr/"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/exam-1/qr?print=1"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/exam-1/grades"), true);
  assert.equal(isHiddenAdminRoute("/admin/exams/exam-1/grades?x=1#top"), true);
});

test("workflow pages and pages that are still used stay open", () => {
  assert.equal(isHiddenAdminRoute("/admin"), false);
  assert.equal(isHiddenAdminRoute("/admin/schedule"), false);
  assert.equal(isHiddenAdminRoute("/admin/schedule/"), false);
  assert.equal(isHiddenAdminRoute("/admin/schedule?exam=1"), false);
  assert.equal(isHiddenAdminRoute("/admin/schedule#codes"), false);
  assert.equal(isHiddenAdminRoute("/admin/bank"), false);
  assert.equal(isHiddenAdminRoute("/admin/bank/Math"), false);
  assert.equal(isHiddenAdminRoute("/admin/review"), false);
  assert.equal(isHiddenAdminRoute("/admin/review/instance-1"), false);
  assert.equal(isHiddenAdminRoute("/admin/students"), false);
  assert.equal(isHiddenAdminRoute("/admin/students/import"), false);
  assert.equal(isHiddenAdminRoute("/admin/settings"), false);
  assert.equal(isHiddenAdminRoute("/admin/questions"), false);
  assert.equal(isHiddenAdminRoute("/admin/questions/new"), false);
  assert.equal(isHiddenAdminRoute("/admin/questions/import"), false);
  assert.equal(isHiddenAdminRoute("/admin/questions/question-1/edit"), false);
  assert.equal(isHiddenAdminRoute("/admin/exams/exam-1/sections"), false);
  assert.equal(isHiddenAdminRoute("/admin/exams/exam-1/timeslots"), false);
  assert.equal(isHiddenAdminRoute("/admin/exams/exam-1/grades/instance-1"), false);
});

test("each hidden page redirects, and pages that stay open do not", () => {
  const guarded: Array<[string, string]> = [
    ["advanced/page.tsx", 'isHiddenAdminRoute("/admin/advanced")'],
    ["exams/page.tsx", 'isHiddenAdminRoute("/admin/exams")'],
    ["exams/new/page.tsx", 'isHiddenAdminRoute("/admin/exams/new")'],
    ["exams/[examId]/qr/page.tsx", "isHiddenAdminRoute(`/admin/exams/${examId}/qr`)"],
    ["exams/[examId]/grades/page.tsx", "isHiddenAdminRoute(`/admin/exams/${examId}/grades`)"],
  ];
  for (const [file, call] of guarded) {
    const source = readFileSync(path.join(adminRoot, file), "utf8");
    assert.equal(source.includes(call), true, file);
    assert.equal(source.includes('redirect("/admin")'), true, file);
  }

  const open = [
    "settings/page.tsx",
    "questions/page.tsx",
    "questions/new/page.tsx",
    "questions/import/page.tsx",
    "questions/[id]/edit/page.tsx",
    "exams/[examId]/sections/page.tsx",
    "exams/[examId]/timeslots/page.tsx",
    "exams/[examId]/grades/[instanceId]/page.tsx",
    "schedule/page.tsx",
    "bank/page.tsx",
    "review/page.tsx",
  ];
  for (const file of open) {
    const source = readFileSync(path.join(adminRoot, file), "utf8");
    assert.equal(source.includes("isHiddenAdminRoute"), false, file);
  }
});
