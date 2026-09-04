"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type QuestionType = "radio" | "numeric" | "text";

type QuestionPayload = {
  question_text: string;
  category: string;
  type: QuestionType;
  options: string[] | null;
  correct_answer: string | null;
};

function parseQuestionPayload(formData: FormData): QuestionPayload {
  const question_text = String(formData.get("question_text") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim() as QuestionType;
  const correctAnswerRaw = String(formData.get("correct_answer") ?? "").trim();
  const optionsRaw = String(formData.get("options") ?? "");

  if (type === "radio") {
    let options: string[] = [];
    try {
      const parsed = JSON.parse(optionsRaw);
      options = Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
    } catch {
      options = [];
    }
    return {
      question_text,
      category,
      type,
      options,
      correct_answer: correctAnswerRaw || null,
    };
  }

  return {
    question_text,
    category,
    type,
    options: null,
    correct_answer: correctAnswerRaw || null,
  };
}

export async function createQuestion(formData: FormData) {
  const supabase = await createClient();
  const payload = parseQuestionPayload(formData);
  const { error } = await supabase.from("questions").insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}

export async function updateQuestion(id: string, formData: FormData) {
  const supabase = await createClient();
  const payload = parseQuestionPayload(formData);
  const { error } = await supabase.from("questions").update(payload).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}
