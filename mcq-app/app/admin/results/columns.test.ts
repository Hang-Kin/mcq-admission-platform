import assert from "node:assert/strict";
import test from "node:test";

import Papa from "papaparse";

import { scoreResponses } from "../exams/gradeScore.ts";
import {
  RESULT_HEADERS,
  buildResultRow,
  csvTextCode,
  filterByIntake,
  formatDuration,
  formatSubmittedAt,
  resultsCsv,
  sortResultRows,
  subjectName,
  summarizeResults,
  type ResultRow,
  type SittingExport,
} from "./columns.ts";

function sitting(overrides: Partial<SittingExport> = {}): SittingExport {
  return {
    submissionCode: "0101",
    englishName: "Ada Wong",
    chineseName: "陳大文",
    intake: "2026-10",
    slot: "Morning",
    startedAt: "2026-06-01T01:00:00.000Z",
    submittedAt: "2026-06-01T01:12:05.000Z",
    assigned: [
      { id: "m1", subject: "Math", category: "Numbers" },
      { id: "m2", subject: "Math", category: "Fractions" },
      { id: "c1", subject: "Chinese", category: "成語" },
      { id: "c2", subject: "Chinese", category: "文言" },
    ],
    responses: [
      { questionId: "m1", isCorrect: true },
      { questionId: "m2", isCorrect: false },
      { questionId: "c2", isCorrect: true },
    ],
    ...overrides,
  };
}

test("column order is fixed and 0101 stays text in the row", () => {
  const row = buildResultRow(sitting());
  assert.deepEqual(RESULT_HEADERS, [
    "提交編號",
    "English name",
    "Chinese name",
    "intake",
    "slot",
    "Math score",
    "Chinese score",
    "total",
    "percentage",
    "time taken",
    "submitted at (HKT)",
  ]);
  assert.equal(row.submissionCode, "0101");
  assert.equal(typeof row.submissionCode, "string");
  assert.equal(csvTextCode(row.submissionCode), '="0101"');
  assert.equal(row.englishName, "Ada Wong");
  assert.equal(row.chineseName, "陳大文");
  assert.equal(row.intake, "2026-10");
  assert.equal(row.slot, "Morning");
  assert.equal(row.mathScore, 1);
  assert.equal(row.chineseScore, 1);
  assert.equal(row.total, 2);
  assert.equal(row.percentage, 50);
  assert.equal(row.timeTaken, "0:12:05");
  assert.equal(row.submittedAt, "2026-06-01 09:12:05");
});

test("category still counts when subject is missing, and midnight is Hong Kong time", () => {
  assert.equal(subjectName({ subject: null, category: "math" }), "Math");
  assert.equal(subjectName({ subject: "Chinese", category: "Math" }), "Chinese");
  const row = buildResultRow(
    sitting({
      assigned: [{ id: "m1", subject: null, category: "Math" }],
      responses: [{ questionId: "m1", isCorrect: true }],
      submittedAt: "2026-06-01T16:00:00.000Z",
      startedAt: "2026-06-01T15:00:00.000Z",
    }),
  );
  assert.equal(row.mathScore, 1);
  assert.equal(row.chineseScore, 0);
  assert.equal(row.submittedAt, "2026-06-02 00:00:00");
  assert.equal(formatDuration("2026-06-01T01:00:00.000Z", null), "");
  assert.equal(formatSubmittedAt("not-a-date"), "");
});

test("csv is utf-8 with a bom, keeps Chinese, and keeps 0101 as text for Excel", () => {
  const csv = resultsCsv([buildResultRow(sitting()), buildResultRow(sitting({ submissionCode: "1002", intake: "2026-11" }))]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const parsed = Papa.parse<Record<string, string>>(csv.slice(1), { header: true });
  assert.deepEqual(parsed.meta.fields, [...RESULT_HEADERS]);
  const first = parsed.data[0];
  assert.ok(first);
  assert.equal(first["提交編號"], '="0101"');
  assert.equal(first["Chinese name"], "陳大文");
  assert.equal(first["English name"], "Ada Wong");
  assert.equal(first["Math score"], "1");
  assert.equal(first["Chinese score"], "1");
  assert.equal(first.total, "2");
  assert.equal(first.percentage, "50");
  assert.match(csv, /陳大文/);
  assert.match(csv, /提交編號/);
});

test("intake filter and summary skip a sitting with no percentage", () => {
  const rows: ResultRow[] = [
    buildResultRow(sitting()),
    buildResultRow(sitting({ submissionCode: "1002", intake: "2026-11", assigned: [], responses: [] })),
  ];
  assert.equal(filterByIntake(rows, "2026-10").length, 1);
  assert.equal(filterByIntake(rows, "").length, 2);
  const summary = summarizeResults(rows);
  assert.equal(summary.studentCount, 2);
  assert.equal(summary.average, 50);
  assert.equal(summary.highest, 50);
  assert.equal(summary.lowest, 50);
  const sorted = sortResultRows([
    buildResultRow(sitting({ submissionCode: "1002" })),
    buildResultRow(sitting({ submissionCode: "0101" })),
  ]);
  assert.deepEqual(
    sorted.map((row) => row.submissionCode),
    ["0101", "1002"],
  );
});

test("total and percentage match the grades page", () => {
  const input = sitting();
  const row = buildResultRow(input);
  const score = scoreResponses(
    input.responses.map((response) => ({ is_correct: response.isCorrect })),
    input.assigned.length,
  );
  assert.equal(row.total, score.correct);
  assert.equal(row.percentage, score.percent);
});

test("summary uses the percentage of each student", () => {
  const low = buildResultRow(
    sitting({
      assigned: [
        { id: "a", subject: "Math", category: "Numbers" },
        { id: "b", subject: "Chinese", category: "成語" },
      ],
      responses: [{ questionId: "a", isCorrect: false }],
    }),
  );
  const high = buildResultRow(
    sitting({
      submissionCode: "1002",
      assigned: [{ id: "a", subject: "Math", category: "Numbers" }],
      responses: [{ questionId: "a", isCorrect: true }],
    }),
  );
  assert.equal(low.percentage, 0);
  assert.equal(high.percentage, 100);
  const summary = summarizeResults([low, high]);
  assert.equal(summary.studentCount, 2);
  assert.equal(summary.average, 50);
  assert.equal(summary.highest, 100);
  assert.equal(summary.lowest, 0);
});
