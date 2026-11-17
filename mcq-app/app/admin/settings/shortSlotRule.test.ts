import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

test("the extreme checklist treats a short slot as a refused save", () => {
  const text = readFileSync(path.join(repoRoot, "docs/extreme-test-checklist.md"), "utf8");
  const start = text.indexOf("### Slot one minute shorter");
  assert.ok(start > -1);
  const next = text.indexOf("\n### ", start + 10);
  const section = text.slice(start, next === -1 ? text.length : next);
  assert.match(section, /A slot shorter than the exam is refused with a message, which is the intended rule/);
  assert.equal(section.includes("the timer shows 5 minutes, not 4"), false);
});
