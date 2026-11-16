import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function sql(name: string): string {
  return readFileSync(path.join(repoRoot, "migrations", name), "utf8");
}

function executable(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

function functionBody(text: string, name: string): string {
  const marker = `function public.${name}`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, name);
  const next = text.indexOf("create or replace function", start + marker.length);
  return text.slice(start, next === -1 ? text.length : next);
}

test("migration 027 is unapplied and refuses to confirm a null mark", () => {
  const text = sql("migration_027_marking_hardening.sql");
  const lower = text.toLowerCase();
  assert.match(text, /UNAPPLIED/);
  assert.match(text, /HIGH RISK/);
  assert.match(lower, /do not apply/);

  const confirm = functionBody(text, "teacher_confirm_response");
  const ungradedAt = confirm.indexOf("if v_is_correct is null");
  const insertAt = confirm.indexOf("insert into public.response_marks");
  assert.ok(ungradedAt > -1 && insertAt > ungradedAt);
  assert.match(confirm, /'ungraded'/);

  const confirmAll = functionBody(text, "teacher_confirm_all");
  assert.match(confirmAll, /resp\.is_correct is not null/);
  assert.match(confirmAll, /resp\.is_correct is null/);
  assert.match(confirmAll, /v_skipped/);

  assert.equal(executable(text).includes("function public.teacher_override_response"), false);
  assert.equal(executable(text).includes("function public.submit_answer"), false);
  assert.equal(/grant [^;]*to anon/i.test(executable(text)), false);
});

test("migration 027 revokes direct writes and recomputes regrade on the server", () => {
  const text = sql("migration_027_marking_hardening.sql");
  assert.match(text, /revoke insert, update, delete on table public\.response_marks from authenticated/);
  assert.match(text, /revoke insert, update, delete on table public\.regrade_log from authenticated/);
  assert.match(text, /grant select on table public\.response_marks to authenticated/);
  assert.match(text, /grant select on table public\.regrade_log to authenticated/);
  assert.match(text, /drop policy if exists "response_marks_insert_staff"/);
  assert.match(text, /drop policy if exists "regrade_log_insert_staff"/);

  const regrade = functionBody(text, "apply_question_regrade");
  assert.match(regrade, /student_answer/);
  assert.match(regrade, /correct_answer/);
  assert.match(regrade, /::numeric/);
  assert.match(regrade, /v_type = 'fraction'/);
  assert.match(regrade, /lower\(trim\(v_answer\)\)/);
  assert.match(regrade, /mark_state = 'overridden'/);
  assert.match(regrade, /state = 'confirmed'/);
  assert.equal(regrade.includes("-> 'is_correct'"), false);
  assert.equal(regrade.includes("->> 'is_correct'"), false);
  assert.match(text, /Rollback/);
});

test("migration 029 is unapplied and names the index and policy cleanup", () => {
  const text = sql("migration_029_performance_cleanup.sql");
  const lower = text.toLowerCase();
  assert.match(text, /UNAPPLIED/);
  assert.match(text, /HIGH RISK/);
  assert.match(lower, /do not apply/);
  assert.match(text, /BEFORE policies/);
  assert.match(text, /AFTER policies/);
  assert.match(text, /\(select auth\.uid\(\)\)/);
  assert.match(text, /in \('questions', 'exams', 'profiles'\)/);
  for (const indexName of [
    "test_instances_exam_id_idx",
    "test_instances_student_id_idx",
    "test_instances_timeslot_id_idx",
    "responses_question_id_idx",
    "responses_reviewed_by_idx",
    "grades_exam_id_idx",
    "exams_active_timeslot_override_idx",
    "section_timeslot_question_sets_section_id_idx",
    "timeslot_draws_question_id_idx",
    "regrade_log_question_id_idx",
  ]) {
    assert.ok(text.includes(indexName), indexName);
  }
  assert.match(text, /profiles_select_merged/);
  assert.match(text, /exams_insert_merged/);
  assert.match(text, /exams_update_merged/);
  assert.equal(/drop policy[^;\n]*test_instances/i.test(executable(text)), false);
  assert.equal(/grant [^;]*to anon/i.test(executable(text)), false);
  assert.match(text, /Rollback/);
});
