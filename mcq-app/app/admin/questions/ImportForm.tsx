"use client";

import { useState, type ChangeEvent } from "react";
import Papa from "papaparse";

import { Button } from "@/components/ui/button";

import { bulkImportQuestions } from "./actions";
import {
  MAX_IMPORT_ROWS,
  validateQuestionRow,
  type QuestionPayload,
} from "./questionValidation";

const CSV_HEADERS = [
  "question_text",
  "category",
  "type",
  "options",
  "correct_answer",
] as const;

const TEMPLATE_CSV = `${CSV_HEADERS.join(",")}
What is the capital of France?,Geography,radio,Paris|London|Berlin,Paris
What is 2+2?,Math,numeric,,4
`;

type PreviewRow = {
  question_text: string;
  category: string;
  type: string;
  error: string | null;
  payload: QuestionPayload | null;
};

function countDataRows(text: string): number {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return 0;
  return Math.max(0, lines.length - 1);
}

function mapCsvRow(row: Record<string, string>) {
  const type = String(row.type ?? "").trim();
  const optionsCell = String(row.options ?? "").trim();

  let options: string[] | null = null;
  if (type === "radio") {
    options = optionsCell.split("|").map((option) => option.trim());
  } else if (optionsCell) {
    options = optionsCell.split("|").map((option) => option.trim());
  }

  return validateQuestionRow({
    question_text: String(row.question_text ?? ""),
    category: String(row.category ?? ""),
    type,
    options,
    correct_answer: String(row.correct_answer ?? ""),
  });
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "questions-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export function ImportForm() {
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const invalidCount = preview.filter((row) => row.error).length;
  const canImport = preview.length > 0 && invalidCount === 0;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    setPreview([]);

    if (!file) return;

    const text = await file.text();
    const dataRowCount = countDataRows(text);

    if (dataRowCount > MAX_IMPORT_ROWS) {
      setError(
        `CSV files are limited to ${MAX_IMPORT_ROWS} questions. This file has ${dataRowCount} data rows.`,
      );
      return;
    }

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      setError(parsed.errors[0]?.message ?? "Failed to parse CSV.");
      return;
    }

    const headers = parsed.meta.fields ?? [];
    const missing = CSV_HEADERS.filter((header) => !headers.includes(header));
    if (missing.length > 0) {
      setError(
        `CSV header must be: ${CSV_HEADERS.join(",")}. Missing: ${missing.join(", ")}.`,
      );
      return;
    }

    if (parsed.data.length === 0) {
      setError("CSV has no data rows.");
      return;
    }

    setPreview(
      parsed.data.map((row) => {
        const result = mapCsvRow(row);
        return {
          question_text: String(row.question_text ?? ""),
          category: String(row.category ?? ""),
          type: String(row.type ?? ""),
          error: result.ok ? null : result.error,
          payload: result.ok ? result.payload : null,
        };
      }),
    );
  }

  async function handleImport() {
    if (!canImport) return;

    const rows = preview
      .map((row) => row.payload)
      .filter((payload): payload is QuestionPayload => payload !== null);

    setIsImporting(true);
    setError(null);
    const result = await bulkImportQuestions(rows);
    if (result?.error) {
      setError(result.error);
      setIsImporting(false);
    }
  }

  return (
    <div className="mt-6 flex max-w-4xl flex-col gap-4">
      <div className="text-sm">
        <p>CSV format (header row required):</p>
        <p className="mt-1 font-mono text-xs">
          question_text,category,type,options,correct_answer
        </p>
        <ul className="mt-2 list-disc pl-5">
          <li>
            <code>type</code> must be exactly <code>radio</code>,{" "}
            <code>numeric</code>, or <code>text</code>
          </li>
          <li>
            For <code>radio</code>: <code>options</code> is a pipe-separated list
            (e.g. <code>Paris|London|Berlin</code>).{" "}
            <code>correct_answer</code> must exactly match one option after
            trimming.
          </li>
          <li>
            For <code>numeric</code> or <code>text</code>: leave{" "}
            <code>options</code> blank; put the value in{" "}
            <code>correct_answer</code>.
          </li>
          <li>Maximum {MAX_IMPORT_ROWS} data rows (after the header).</li>
        </ul>
      </div>

      <div>
        <button type="button" className="underline" onClick={downloadTemplate}>
          Download template
        </button>
      </div>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {preview.length > 0 ? (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b py-2 pr-4">Question</th>
              <th className="border-b py-2 pr-4">Category</th>
              <th className="border-b py-2 pr-4">Type</th>
              <th className="border-b py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((row, index) => (
              <tr key={index}>
                <td className="border-b py-2 pr-4">
                  {truncate(row.question_text, 60)}
                </td>
                <td className="border-b py-2 pr-4">{row.category}</td>
                <td className="border-b py-2 pr-4">{row.type}</td>
                <td className="border-b py-2">
                  {row.error ? row.error : "✓"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <Button type="button" disabled={!canImport || isImporting} onClick={handleImport}>
        {isImporting
          ? "Importing…"
          : canImport
            ? `Import ${preview.length} questions`
            : "Import questions"}
      </Button>
    </div>
  );
}
