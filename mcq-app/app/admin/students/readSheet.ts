import { strFromU8, unzipSync } from "fflate";
import Papa from "papaparse";

import { mapRosterSheet, type RosterInputRow } from "./importRoster";

const MAX_SHEET_BYTES = 5_000_000;
const MAX_COLUMNS = 80;

export type SheetResult =
  | { ok: true; rows: RosterInputRow[] }
  | { ok: false; error: string };

type GridRow = { line: number; cells: string[] };

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textOf(files: Record<string, Uint8Array>, path: string): string | null {
  const bytes = files[path];
  if (!bytes) return null;
  return strFromU8(bytes);
}

function sharedStrings(xml: string): string[] {
  const pieces = xml.split(/<si[\s>]/).slice(1);
  return pieces.map((piece) => {
    const body = (piece.split(/<\/si>/)[0] ?? "")
      .replace(/<rPh[\s\S]*?<\/rPh>/g, "")
      .replace(/<phoneticPr\b[^>]*\/>/g, "");
    const parts: string[] = [];
    const pattern = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body))) {
      parts.push(decodeXml(match[1] ?? ""));
    }
    return parts.join("");
  });
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0]?.toUpperCase() ?? "";
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function digitIndex(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;
  let index = 0;
  for (const char of value) index = index * 10 + (char.charCodeAt(0) - 48);
  return index;
}

function cellText(
  cellXml: string,
  strings: string[],
): { index: number; text: string } | null {
  const ref = /\br="([^"]+)"/.exec(cellXml)?.[1] ?? "";
  const type = /\bt="([^"]+)"/.exec(cellXml)?.[1] ?? "";
  const index = ref ? columnIndex(ref) : -1;
  if (type === "inlineStr") {
    const parts: string[] = [];
    const pattern = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cellXml))) {
      parts.push(decodeXml(match[1] ?? ""));
    }
    return { index, text: parts.join("") };
  }

  const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(cellXml)?.[1];
  if (raw == null) return { index, text: "" };
  const value = decodeXml(raw);
  if (type === "s") {
    const stringIndex = digitIndex(value);
    if (stringIndex == null) return { index, text: value };
    return { index, text: strings[stringIndex] ?? "" };
  }
  return { index, text: value };
}

function worksheetRows(xml: string, strings: string[]): GridRow[] {
  const rows: GridRow[] = [];
  const rowPattern = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  let fallbackLine = 1;
  while ((rowMatch = rowPattern.exec(xml))) {
    const attrs = rowMatch[1] ?? "";
    const body = rowMatch[2] ?? "";
    const lineAttr = /\br="(\d+)"/.exec(attrs)?.[1];
    const line = lineAttr ? digitIndex(lineAttr) ?? fallbackLine : fallbackLine;
    fallbackLine += 1;
    const cells = new Map<number, string>();
    let nextIndex = 0;
    const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(body))) {
      const cellXml = `<c ${cellMatch[1] ?? ""}>${cellMatch[2] ?? ""}</c>`;
      const parsed = cellText(cellXml, strings);
      if (!parsed) continue;
      const index = parsed.index >= 0 ? parsed.index : nextIndex;
      nextIndex = index + 1;
      if (index >= 0 && index < MAX_COLUMNS) cells.set(index, parsed.text);
    }
    const width = Math.min(
      MAX_COLUMNS,
      Math.max(0, ...cells.keys(), -1) + 1,
    );
    const values = Array.from({ length: width }, () => "");
    for (const [index, value] of cells) values[index] = value;
    rows.push({ line: Number.isFinite(line) ? line : fallbackLine, cells: values });
  }
  return rows;
}

function sheetPath(files: Record<string, Uint8Array>): string | null {
  const workbook = textOf(files, "xl/workbook.xml");
  const rels = textOf(files, "xl/_rels/workbook.xml.rels");
  const sheetTag = workbook ? /<sheet\b[^>]*>/.exec(workbook)?.[0] : undefined;
  const relId = sheetTag ? /\br:id="([^"]+)"/.exec(sheetTag)?.[1] : undefined;
  if (rels && relId) {
    const rel = new RegExp(`<Relationship\\b[^>]*Id="${relId}"[^>]*>`).exec(rels)?.[0];
    const target = rel ? /\bTarget="([^"]+)"/.exec(rel)?.[1] : undefined;
    if (target) {
      const clean = target.replace(/^\//, "");
      return clean.startsWith("xl/") ? clean : `xl/${clean.replace(/^\.\//, "")}`;
    }
  }
  return Object.keys(files).find((path) => /xl\/worksheets\/sheet\d+\.xml$/.test(path)) ?? null;
}

function readXlsx(bytes: Uint8Array): SheetResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { ok: false, error: "Could not read that spreadsheet." };
  }
  const path = sheetPath(files);
  const sheet = path ? textOf(files, path) : null;
  if (!sheet) return { ok: false, error: "The spreadsheet has no sheet." };
  const shared = textOf(files, "xl/sharedStrings.xml");
  const grid = worksheetRows(sheet, shared ? sharedStrings(shared) : []).filter((row) =>
    row.cells.some((cell) => cell.trim() !== ""),
  );
  if (grid.length === 0) return { ok: false, error: "The file has no rows." };
  const [headerRow, ...dataRows] = grid;
  return mapRosterSheet(headerRow?.cells ?? [], dataRows);
}

function cellString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return null;
}

function readCsv(bytes: Uint8Array): SheetResult {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  const parsed = Papa.parse<unknown[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });
  const fatal = parsed.errors.find((error) => error.type === "Quotes");
  if (fatal) return { ok: false, error: "Could not read that CSV file." };
  const grid: string[][] = [];
  for (const row of parsed.data) {
    if (!Array.isArray(row)) {
      return { ok: false, error: "A cell was read as a number. The code must stay text." };
    }
    const cells: string[] = [];
    for (const value of row) {
      const textValue = cellString(value);
      if (textValue == null) {
        return { ok: false, error: "A cell was read as a number. The code must stay text." };
      }
      cells.push(textValue);
    }
    grid.push(cells);
  }
  if (grid.length === 0) return { ok: false, error: "The file has no rows." };
  const [header, ...data] = grid;
  return mapRosterSheet(
    header ?? [],
    data.map((cells, index) => ({ line: index + 2, cells })),
  );
}

export function readRosterFile(name: string, bytes: Uint8Array): SheetResult {
  if (bytes.byteLength > MAX_SHEET_BYTES) {
    return { ok: false, error: "The file is larger than 5 MB." };
  }
  const lower = name.trim().toLowerCase();
  if (lower.endsWith(".csv")) return readCsv(bytes);
  if (lower.endsWith(".xlsx")) return readXlsx(bytes);
  return { ok: false, error: "Upload a .xlsx or .csv file." };
}
