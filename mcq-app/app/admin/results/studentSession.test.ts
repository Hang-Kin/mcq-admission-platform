import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  STUDENT_SESSION_QUESTION_KEYS,
  anonCannotSelectCorrectAnswer,
  questionKeysFromExamSectionQuestions,
  studentSessionPayload,
} from "./studentSession.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function sql(name: string) {
  return readFileSync(path.join(repoRoot, "migrations", name), "utf8");
}

test("a student session cannot read the correct answer", () => {
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
  assert.equal(question.question_text, "2 + 2");
  assert.deepEqual(question.options, ["3", "4"]);
});

test("the student question payload matches exam_section_questions and omits correct_answer", () => {
  const definers = readdirSync(path.join(repoRoot, "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .filter((name) =>
      /create or replace function public\.exam_section_questions/i.test(sql(name)),
    )
    .sort();
  assert.deepEqual(definers, [
    "migration_013_exam_sections.sql",
    "migration_020_question_subject.sql",
  ]);

  const keys = questionKeysFromExamSectionQuestions(sql("migration_020_question_subject.sql"));
  assert.deepEqual(keys, [...STUDENT_SESSION_QUESTION_KEYS]);
  assert.equal(keys.includes("correct_answer"), false);
});

test("anonymous select cannot include correct_answer", () => {
  const file = sql("migration_024_hide_correct_answer_from_anon.sql");
  assert.equal(anonCannotSelectCorrectAnswer(file), true);
  assert.equal(/create or replace function public\.exam_section_questions/i.test(file), false);
});
