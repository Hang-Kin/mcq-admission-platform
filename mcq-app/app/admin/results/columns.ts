import ExcelJS from "exceljs";
import Papa from "papaparse";

export const RESULT_HEADERS = [
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
] as const;

export type ResultHeader = (typeof RESULT_HEADERS)[number];

export type ExportQuestion = {
  id: string;
  subject?: string | null;
  category?: string | null;
};

export type ExportResponse = {
  questionId: string;
  isCorrect: boolean | null;
};

export type SittingExport = {
  submissionCode: string;
  englishName: string;
  chineseName: string;
  intake: string;
  slot: string;
  startedAt: string | null;
  submittedAt: string | null;
  assigned: ExportQuestion[];
  responses: ExportResponse[];
};

export type ResultRow = {
  submissionCode: string;
  englishName: string;
  chineseName: string;
  intake: string;
  slot: string;
  mathScore: number;
  chineseScore: number;
  total: number;
  percentage: number | null;
  timeTaken: string;
  submittedAt: string;
};

export type ResultSummary = {
  studentCount: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
};

export function subjectName(question: {
  subject?: string | null;
  category?: string | null;
}): "Math" | "Chinese" | null {
  const subject = question.subject?.trim().toLowerCase();
  if (subject === "math") return "Math";
  if (subject === "chinese") return "Chinese";
  const category = (question.category ?? "").trim().toLowerCase();
  if (category === "math") return "Math";
  if (category === "chinese") return "Chinese";
  return null;
}

export function idList(value: unknown): string[] {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function formatDuration(startedAt: string | null, submittedAt: string | null): string {
  if (!startedAt || !submittedAt) return "";
  const start = Date.parse(startedAt);
  const end = Date.parse(submittedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "";
  const totalSeconds = Math.round((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = read("hour") === "24" ? "00" : read("hour");
  return `${read("year")}-${read("month")}-${read("day")} ${hour}:${read("minute")}:${read("second")}`;
}

// Excel opens a CSV number as a number, which drops the leading zero in 0101.
// ="0101" is text when Excel opens the file, and the characters stay 0101.
export function csvTextCode(code: string): string {
  return `="${code.replace(/"/g, '""')}"`;
}

// Same total and percentage as the grades page: unanswered assigned questions
// stay in the denominator, and only is_correct === true counts.
function scoreSitting(
  responses: ExportResponse[],
  assignedCount: number,
): { correct: number; percent: number | null } {
  const total = assignedCount > 0 ? assignedCount : responses.length;
  const correct = responses.filter((response) => response.isCorrect === true).length;
  const percent = total === 0 ? null : Math.round((correct / total) * 1000) / 10;
  return { correct, percent };
}

export function buildResultRow(input: SittingExport): ResultRow {
  const score = scoreSitting(input.responses, input.assigned.length);
  const correctByQuestion = new Map(
    input.responses.map((response) => [response.questionId, response.isCorrect === true]),
  );
  let mathScore = 0;
  let chineseScore = 0;
  for (const question of input.assigned) {
    if (correctByQuestion.get(question.id) !== true) continue;
    const subject = subjectName(question);
    if (subject === "Math") mathScore += 1;
    if (subject === "Chinese") chineseScore += 1;
  }
  return {
    submissionCode: input.submissionCode,
    englishName: input.englishName.trim(),
    chineseName: input.chineseName.trim(),
    intake: input.intake.trim(),
    slot: input.slot.trim(),
    mathScore,
    chineseScore,
    total: score.correct,
    percentage: score.percent,
    timeTaken: formatDuration(input.startedAt, input.submittedAt),
    submittedAt: formatSubmittedAt(input.submittedAt),
  };
}

export function filterByIntake(rows: ResultRow[], intake: string): ResultRow[] {
  if (!intake) return rows;
  return rows.filter((row) => row.intake === intake);
}

export function sortResultRows(rows: ResultRow[]): ResultRow[] {
  return [...rows].sort(
    (a, b) =>
      a.submissionCode.localeCompare(b.submissionCode) ||
      a.submittedAt.localeCompare(b.submittedAt),
  );
}

export function summarizeResults(rows: ResultRow[]): ResultSummary {
  const scores = rows
    .map((row) => row.percentage)
    .filter((value): value is number => value !== null);
  if (scores.length === 0) {
    return { studentCount: rows.length, average: null, highest: null, lowest: null };
  }
  const sum = scores.reduce((total, value) => total + value, 0);
  return {
    studentCount: rows.length,
    average: Math.round((sum / scores.length) * 10) / 10,
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
  };
}

export type SheetCell = string | number | null;

export function resultCells(row: ResultRow, mode: "xlsx" | "csv"): SheetCell[] {
  return [
    mode === "csv" ? csvTextCode(row.submissionCode) : row.submissionCode,
    row.englishName,
    row.chineseName,
    row.intake,
    row.slot,
    row.mathScore,
    row.chineseScore,
    row.total,
    row.percentage,
    row.timeTaken,
    row.submittedAt,
  ];
}

export function resultsCsv(rows: ResultRow[]): string {
  const table = Papa.unparse({
    fields: [...RESULT_HEADERS],
    data: rows.map((row) => resultCells(row, "csv")),
  });
  return `\uFEFF${table}`;
}

const TEXT_FORMAT = "@";

function summaryValue(value: number | null): number | "" {
  return value === null ? "" : value;
}

export async function resultsWorkbook(rows: ResultRow[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Results");
  sheet.addRow([...RESULT_HEADERS]);
  sheet.getColumn(1).numFmt = TEXT_FORMAT;

  for (const row of rows) {
    const added = sheet.addRow(resultCells(row, "xlsx"));
    const code = added.getCell(1);
    code.value = row.submissionCode;
    code.numFmt = TEXT_FORMAT;
  }

  const summary = workbook.addWorksheet("Summary");
  const stats = summarizeResults(rows);
  summary.addRow(["Student count", stats.studentCount]);
  summary.addRow(["Average", summaryValue(stats.average)]);
  summary.addRow(["Highest", summaryValue(stats.highest)]);
  summary.addRow(["Lowest", summaryValue(stats.lowest)]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
