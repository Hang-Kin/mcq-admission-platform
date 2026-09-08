"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  MAX_IMPORT_ROWS,
  validateQuestionRow,
  type QuestionPayload,
} from "./questionValidation";

export type { QuestionPayload };

function parseQuestionPayload(
  formData: FormData,
): ReturnType<typeof validateQuestionRow> {
  const question_text = String(formData.get("question_text") ?? "");
  const category = String(formData.get("category") ?? "");
  const type = String(formData.get("type") ?? "").trim();
  const correctAnswerRaw = String(formData.get("correct_answer") ?? "");
  const optionsRaw = String(formData.get("options") ?? "");

  let options: string[] | null = null;
  if (type === "radio") {
    try {
      const parsed = JSON.parse(optionsRaw);
      options = Array.isArray(parsed)
        ? parsed.map((value) => String(value))
        : [];
    } catch {
      options = [];
    }
  }

  return validateQuestionRow({
    question_text,
    category,
    type,
    options,
    correct_answer: correctAnswerRaw,
  });
}

export async function createQuestion(formData: FormData) {
  const parsed = parseQuestionPayload(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("questions").insert(parsed.payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}

export async function updateQuestion(id: string, formData: FormData) {
  const parsed = parseQuestionPayload(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update(parsed.payload)
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}

export async function bulkImportQuestions(rows: QuestionPayload[]) {
  if (rows.length === 0) {
    return { error: "CSV has no data rows." };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      error: `CSV files are limited to ${MAX_IMPORT_ROWS} questions. This import has ${rows.length} data rows.`,
    };
  }

  for (const row of rows) {
    const result = validateQuestionRow(row);
    if (!result.ok) {
      return { error: result.error };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("questions").insert(rows);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}
