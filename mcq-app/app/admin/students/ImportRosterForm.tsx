"use client";

import { useEffect, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { importStudents, listIntakeNumbers } from "./actions";
import { IntakeFields } from "./IntakeFields";
import {
  classifyRosterRows,
  CHINESE_NAME_HEADER,
  CODE_HEADER,
  ENGLISH_NAME_HEADER,
  PROBLEM_LABEL,
  tallyRoster,
  type ClassifiedRosterRow,
  type RosterInputRow,
} from "./importRoster";
import { composeIntake, formatIntakeLabel } from "./intakeLabel";
import { readRosterFile } from "./readSheet";

export function ImportRosterForm() {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [rows, setRows] = useState<RosterInputRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const intake = composeIntake(year, month);

  useEffect(() => {
    if (!intake) {
      setExisting([]);
      setLookupError(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    setLookupError(null);
    void listIntakeNumbers(intake).then((result) => {
      if (cancelled) return;
      setChecking(false);
      if (result.error) {
        setLookupError(result.error);
        setExisting([]);
        return;
      }
      setExisting(result.numbers ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [intake]);

  const preview: ClassifiedRosterRow[] = classifyRosterRows(rows, new Set(existing));
  const tally = tallyRoster(preview);
  const previewSummary =
    rows.length > 0
      ? `${tally.added} to add, ${tally.alreadyThere} already there, ${tally.errors} ${tally.errors === 1 ? "error" : "errors"}`
      : null;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError(null);
    setSummary(null);
    setImportError(null);
    setRows([]);
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = readRosterFile(file.name, bytes);
    if (!result.ok) {
      setFileError(result.error);
      return;
    }
    setRows(result.rows);
  }

  async function handleImport() {
    if (!intake || rows.length === 0 || checking || lookupError) return;
    setIsImporting(true);
    setImportError(null);
    setSummary(null);
    const result = await importStudents({
      intake,
      rows: rows.map((row) => ({
        applicationNumber: row.applicationNumber,
        name: row.name,
        chineseName: row.chineseName ?? "",
      })),
    });
    setIsImporting(false);
    if (result.error) {
      setImportError(result.error);
      return;
    }
    const fresh = await listIntakeNumbers(intake);
    if (fresh.numbers) setExisting(fresh.numbers);
    setSummary(result.summary ?? null);
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <IntakeFields year={year} month={month} onYear={setYear} onMonth={setMonth} idPrefix="import-intake" />
      {intake ? (
        <p className="text-sm text-foreground">{formatIntakeLabel(intake)}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a year and a month.</p>
      )}

      <div className="flex max-w-xl flex-col gap-2">
        <Label htmlFor="roster-file">Spreadsheet</Label>
        <Input
          id="roster-file"
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => void handleFile(event)}
        />
        <p className="text-sm text-muted-foreground">
          Columns used: {CODE_HEADER}, {ENGLISH_NAME_HEADER}, and {CHINESE_NAME_HEADER}. ID and 參考編號 are ignored.
        </p>
      </div>

      {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
      {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}
      {checking ? <p className="text-sm text-muted-foreground">Checking this intake…</p> : null}

      {preview.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground">{previewSummary}</p>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b py-3 pr-4">Row</th>
                  <th className="border-b py-3 pr-4">{CODE_HEADER}</th>
                  <th className="border-b py-3 pr-4">{ENGLISH_NAME_HEADER}</th>
                  <th className="border-b py-3 pr-4">{CHINESE_NAME_HEADER}</th>
                  <th className="border-b py-3">Problems</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={`${row.line}-${row.applicationNumber}-${row.name}-${row.chineseName}`} className={row.outcome === "error" ? "text-destructive" : undefined}>
                    <td className="border-b py-3 pr-4">{row.line}</td>
                    <td className="border-b py-3 pr-4">{row.applicationNumber}</td>
                    <td className="border-b py-3 pr-4">{row.name}</td>
                    <td className="border-b py-3 pr-4">{row.chineseName}</td>
                    <td className="border-b py-3">
                      {row.problems.map((problem) => PROBLEM_LABEL[problem]).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {summary ? <p className="text-sm text-foreground">{summary}</p> : null}
      {importError ? <p className="text-sm text-destructive">{importError}</p> : null}

      <Button
        type="button"
        disabled={!intake || rows.length === 0 || checking || Boolean(lookupError) || isImporting}
        onClick={() => void handleImport()}
      >
        {isImporting ? "Importing…" : "Import"}
      </Button>
    </div>
  );
}
