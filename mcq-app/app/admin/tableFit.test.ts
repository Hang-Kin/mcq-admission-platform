import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const pages = [
  "app/admin/exams/page.tsx",
  "app/admin/questions/page.tsx",
  "app/admin/review/page.tsx",
  "app/admin/exams/[examId]/grades/page.tsx",
  "app/admin/schedule/SittingDayGrid.tsx",
];

test("wide staff tables scroll inside the page instead of forcing it past 1280px", () => {
  for (const file of pages) {
    const text = readFileSync(path.join(appRoot, file), "utf8");
    assert.equal(text.includes("min-w-[48rem]"), false, file);
    assert.equal(text.includes("min-w-[40rem]"), false, file);
    assert.match(text, /min-w-0 max-w-full overflow-x-auto/, file);
  }
  const frame = readFileSync(path.join(appRoot, "components/staff-nav-gate.tsx"), "utf8");
  assert.match(frame, /min-w-0 max-w-6xl/);
});
