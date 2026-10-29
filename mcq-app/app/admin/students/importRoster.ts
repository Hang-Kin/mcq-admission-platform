import { APPLICATION_NUMBER_RE } from "./intakeLabel";

export const CODE_HEADER = "提交編號";
export const NAME_HEADER = "Full English name";
export const MAX_IMPORT_ROWS = 5000;

export type RosterProblem =
  | "blank"
  | "not_4_digits"
  | "duplicate_in_file"
  | "already_in_intake";

export type RosterOutcome = "add" | "already" | "error";

export type RosterInputRow = {
  line: number;
  applicationNumber: string;
  name: string;
};

export type ClassifiedRosterRow = {
  line: number;
  applicationNumber: string;
  name: string;
  problems: RosterProblem[];
  outcome: RosterOutcome;
};

export type ImportTally = {
  added: number;
  alreadyThere: number;
  errors: number;
};

export const PROBLEM_LABEL: Record<RosterProblem, string> = {
  blank: "Blank",
  not_4_digits: "Not 4 digits",
  duplicate_in_file: "Duplicate in the file",
  already_in_intake: "Already in this intake",
};

export function cleanHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim();
}

export function mapRosterHeaders(
  headers: string[],
):
  | { ok: true; codeIndex: number; nameIndex: number }
  | { ok: false; error: string } {
  const cleaned = headers.map(cleanHeader);
  const codeIndex = cleaned.indexOf(CODE_HEADER);
  const nameIndex = cleaned.indexOf(NAME_HEADER);
  const missing: string[] = [];
  if (codeIndex < 0) missing.push(CODE_HEADER);
  if (nameIndex < 0) missing.push(NAME_HEADER);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `The file needs a column named ${missing.join(" and ")}. Other columns are ignored.`,
    };
  }
  return { ok: true, codeIndex, nameIndex };
}

export function mapRosterSheet(
  header: string[],
  rows: Array<{ line: number; cells: string[] }>,
):
  | { ok: true; rows: RosterInputRow[] }
  | { ok: false; error: string } {
  const mapped = mapRosterHeaders(header);
  if (!mapped.ok) return mapped;

  const roster: RosterInputRow[] = [];
  for (const row of rows) {
    const applicationNumber = row.cells[mapped.codeIndex] ?? "";
    const name = row.cells[mapped.nameIndex] ?? "";
    if (applicationNumber.trim() === "" && name.trim() === "") continue;
    roster.push({ line: row.line, applicationNumber, name });
  }

  if (roster.length === 0) {
    return { ok: false, error: "The file has no students." };
  }
  if (roster.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `Import ${MAX_IMPORT_ROWS} students or fewer at a time.`,
    };
  }
  return { ok: true, rows: roster };
}

export function rowOutcome(problems: RosterProblem[]): RosterOutcome {
  if (
    problems.some(
      (problem) =>
        problem === "blank" ||
        problem === "not_4_digits" ||
        problem === "duplicate_in_file",
    )
  ) {
    return "error";
  }
  if (problems.includes("already_in_intake")) return "already";
  return "add";
}

export function classifyRosterRows(
  rows: RosterInputRow[],
  existing: ReadonlySet<string>,
): ClassifiedRosterRow[] {
  const trimmed = rows
    .map((row) => ({
      line: row.line,
      applicationNumber: row.applicationNumber.trim(),
      name: row.name.trim(),
    }))
    .filter((row) => row.applicationNumber !== "" || row.name !== "");

  const counts = new Map<string, number>();
  for (const row of trimmed) {
    if (!APPLICATION_NUMBER_RE.test(row.applicationNumber)) continue;
    counts.set(
      row.applicationNumber,
      (counts.get(row.applicationNumber) ?? 0) + 1,
    );
  }

  return trimmed.map((row) => {
    const problems: RosterProblem[] = [];
    const code = row.applicationNumber;
    if (code === "" || row.name === "") problems.push("blank");
    if (code !== "" && !APPLICATION_NUMBER_RE.test(code)) {
      problems.push("not_4_digits");
    }
    if (APPLICATION_NUMBER_RE.test(code) && (counts.get(code) ?? 0) > 1) {
      problems.push("duplicate_in_file");
    }
    if (APPLICATION_NUMBER_RE.test(code) && existing.has(code)) {
      problems.push("already_in_intake");
    }
    return { ...row, problems, outcome: rowOutcome(problems) };
  });
}

export function tallyRoster(
  rows: Array<{ outcome: RosterOutcome }>,
  extraErrors = 0,
): ImportTally {
  const tally: ImportTally = { added: 0, alreadyThere: 0, errors: extraErrors };
  for (const row of rows) {
    if (row.outcome === "add") tally.added += 1;
    else if (row.outcome === "already") tally.alreadyThere += 1;
    else tally.errors += 1;
  }
  return tally;
}

export function formatImportSummary(tally: ImportTally): string {
  const errorWord = tally.errors === 1 ? "error" : "errors";
  return `${tally.added} added, ${tally.alreadyThere} already there, ${tally.errors} ${errorWord}`;
}

export type IncomingRosterCell =
  | { applicationNumber: string; name: string }
  | { invalid: true };

export function normalizeImportRows(
  rows: Array<{ applicationNumber: unknown; name: unknown }>,
): IncomingRosterCell[] {
  return rows.map((row) => {
    if (typeof row.applicationNumber !== "string" || typeof row.name !== "string") {
      return { invalid: true };
    }
    return {
      applicationNumber: row.applicationNumber,
      name: row.name,
    };
  });
}

export function rowsToInsert(
  rows: ClassifiedRosterRow[],
): Array<{ applicationNumber: string; name: string }> {
  return rows
    .filter((row) => row.outcome === "add")
    .map((row) => ({
      applicationNumber: row.applicationNumber,
      name: row.name,
    }));
}
