import assert from "node:assert/strict";
import test from "node:test";

import { strFromU8, unzipSync } from "fflate";
import ExcelJS from "exceljs";

import { RESULT_HEADERS, buildResultRow, resultsWorkbook, type SittingExport } from "./columns.ts";

function sitting(): SittingExport {
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
      { id: "c1", subject: "Chinese", category: "成語" },
    ],
    responses: [
      { questionId: "m1", isCorrect: true },
      { questionId: "c1", isCorrect: false },
    ],
  };
}

function cellText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "richText" in value) {
    const rich = value as { richText?: Array<{ text?: string }> };
    return (rich.richText ?? []).map((part) => part.text ?? "").join("");
  }
  return "";
}

test("excel stores 0101 as text and the summary sheet", async () => {
  const bytes = await resultsWorkbook([buildResultRow(sitting())]);
  const files = unzipSync(bytes);
  const shared = strFromU8(files["xl/sharedStrings.xml"] ?? new Uint8Array());
  assert.match(shared, /0101/);
  assert.match(shared, /陳大文/);
  assert.doesNotMatch(shared, />101</);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes));
  const sheet = workbook.getWorksheet("Results");
  assert.ok(sheet);
  assert.deepEqual(
    RESULT_HEADERS.map((_, index) => cellText(sheet.getRow(1).getCell(index + 1).value)),
    [...RESULT_HEADERS],
  );
  const code = sheet.getRow(2).getCell(1);
  assert.equal(cellText(code.value), "0101");
  assert.equal(code.numFmt, "@");
  assert.equal(cellText(sheet.getRow(2).getCell(3).value), "陳大文");
  assert.equal(sheet.getRow(2).getCell(6).value, 1);
  assert.equal(sheet.getRow(2).getCell(7).value, 0);
  assert.equal(sheet.getRow(2).getCell(8).value, 1);
  assert.equal(sheet.getRow(2).getCell(9).value, 50);

  const summary = workbook.getWorksheet("Summary");
  assert.ok(summary);
  assert.equal(cellText(summary.getRow(1).getCell(1).value), "Student count");
  assert.equal(summary.getRow(1).getCell(2).value, 1);
  assert.equal(cellText(summary.getRow(2).getCell(1).value), "Average");
  assert.equal(summary.getRow(2).getCell(2).value, 50);
  assert.equal(summary.getRow(3).getCell(2).value, 50);
  assert.equal(summary.getRow(4).getCell(2).value, 50);
});
