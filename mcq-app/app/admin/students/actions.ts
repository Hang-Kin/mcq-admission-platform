"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  classifyRosterRows,
  formatImportSummary,
  MAX_IMPORT_ROWS,
  normalizeImportRows,
  rowsToInsert,
  tallyRoster,
} from "./importRoster";
import { APPLICATION_NUMBER_RE, composeIntake, INTAKE_RE } from "./intakeLabel";
import { INTAKE_WAITING_WRITE, isMissingSchema } from "./schemaError";

export type CreateStudentResult = { error?: string } | void;

export type ImportStudentsResult = { summary?: string; error?: string };

function writeError(error: { code?: string; message?: string }): string {
  if (isMissingSchema(error)) return INTAKE_WAITING_WRITE;
  if (error.code === "23505") return "That 提交編號 is already in this intake.";
  if (error.code === "23514") return "提交編號 must be 4 digits.";
  return "Could not add this student. You may not have permission.";
}

export async function createStudent(formData: FormData): Promise<CreateStudentResult> {
  const name = String(formData.get("name") ?? "").trim();
  const applicationNumber = String(formData.get("application_number") ?? "").trim();
  const intake = composeIntake(
    String(formData.get("intake_year") ?? ""),
    String(formData.get("intake_month") ?? ""),
  );

  if (!intake) return { error: "Choose an intake." };
  if (!name) return { error: "Full English name is required." };
  if (!APPLICATION_NUMBER_RE.test(applicationNumber)) {
    return { error: "提交編號 must be 4 digits." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    name,
    application_number: applicationNumber,
    intake,
  });

  if (error) return { error: writeError(error) };
  revalidatePath("/admin/students");
  revalidatePath("/admin/schedule");
}

export async function listIntakeNumbers(
  intake: string,
): Promise<{ numbers?: string[]; error?: string }> {
  if (!INTAKE_RE.test(intake)) {
    return { error: "Choose an intake." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("application_number")
    .eq("intake", intake);
  if (error) {
    if (isMissingSchema(error)) return { error: INTAKE_WAITING_WRITE };
    return { error: "Could not check this intake." };
  }

  const numbers = (data ?? []).flatMap((row) =>
    typeof row.application_number === "string" ? [row.application_number] : [],
  );
  return { numbers };
}

export async function importStudents(input: {
  intake: string;
  rows: Array<{ applicationNumber: unknown; name: unknown }>;
}): Promise<ImportStudentsResult> {
  const intake = INTAKE_RE.test(input.intake) ? input.intake : null;
  if (!intake) return { error: "Choose an intake." };
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { error: "The file has no students." };
  }
  if (input.rows.length > MAX_IMPORT_ROWS) {
    return { error: `Import ${MAX_IMPORT_ROWS} students or fewer at a time.` };
  }

  const normalized = normalizeImportRows(input.rows);
  const invalidCount = normalized.filter((row) => "invalid" in row).length;
  const valid = normalized.flatMap((row) => ("invalid" in row ? [] : [row]));
  const supabase = await createClient();
  const { data: existingRows, error: existingError } = await supabase
    .from("students")
    .select("application_number")
    .eq("intake", intake);
  if (existingError) {
    if (isMissingSchema(existingError)) return { error: INTAKE_WAITING_WRITE };
    return { error: "Could not check this intake." };
  }

  const existing = new Set(
    (existingRows ?? []).flatMap((row) =>
      typeof row.application_number === "string" ? [row.application_number] : [],
    ),
  );
  const classified = classifyRosterRows(
    valid.map((row, index) => ({
      line: index + 2,
      applicationNumber: row.applicationNumber,
      name: row.name,
    })),
    existing,
  );
  const toInsert = rowsToInsert(classified);
  let added = 0;
  let alreadyFromRace = 0;

  if (toInsert.length > 0) {
    const payload = toInsert.map((row) => ({
      name: row.name,
      application_number: row.applicationNumber,
      intake,
    }));
    const { error } = await supabase.from("students").insert(payload);
    if (!error) {
      added = payload.length;
    } else if (error.code === "23505") {
      for (const row of payload) {
        const result = await supabase.from("students").insert(row);
        if (!result.error) added += 1;
        else if (result.error.code === "23505") alreadyFromRace += 1;
        else return { error: writeError(result.error) };
      }
    } else {
      return { error: writeError(error) };
    }
  }

  const tally = tallyRoster(classified, invalidCount);
  tally.added = added;
  tally.alreadyThere += alreadyFromRace;
  revalidatePath("/admin/students");
  revalidatePath("/admin/schedule");
  return { summary: formatImportSummary(tally) };
}
