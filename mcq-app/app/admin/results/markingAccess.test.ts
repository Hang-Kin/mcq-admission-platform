import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { studentSessionPayload } from "./studentSession.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

test("migration 026 does not give anonymous users marks or the correct answer", () => {
  const sql = readFileSync(
    path.join(repoRoot, "migrations", "migration_026_teacher_marking.sql"),
    "utf8",
  );
  const text = sql.toLowerCase();
  assert.match(text, /revoke all on table public\.response_marks from anon/);
  assert.match(text, /revoke all on table public\.regrade_log from anon/);
  assert.match(text, /revoke all on function public\.apply_question_regrade\(uuid, text, text, jsonb\) from anon/);
  assert.equal(/grant [^;]*to anon/.test(text), false);
  assert.equal(text.includes("exam_section_questions"), false);
  assert.equal(text.includes("grant select (correct_answer"), false);
  assert.match(text, /state = 'overridden'/);
});

test("a student session still cannot read the correct answer", () => {
  const payload = studentSessionPayload({
    ok: true,
    questions: [
      {
        id: "q1",
        question_text: "2 + 2",
        type: "numeric",
        options: ["3", "4"],
        category: "Numbers",
        subject: "Math",
        question_set: "Math",
        image_url: null,
        correct_answer: "SECRET-4",
      },
    ],
  }) as { questions: Array<Record<string, unknown>> };

  const question = payload.questions[0];
  assert.ok(question);
  assert.equal("correct_answer" in question, false);
  assert.equal(JSON.stringify(payload).includes("SECRET-4"), false);
  assert.equal(JSON.stringify(payload).includes("correct_answer"), false);
});
