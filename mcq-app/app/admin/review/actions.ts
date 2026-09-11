"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ReviewActionState = { error?: string } | null;

export async function reviewResponse(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const verdict = String(formData.get("verdict") ?? "").trim();

  if (!id) {
    return { error: "Missing response id." };
  }

  if (verdict !== "correct" && verdict !== "incorrect") {
    return { error: "Choose mark correct or mark incorrect." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("responses")
    .update({
      is_correct: verdict === "correct",
      needs_review: false,
    })
    .eq("id", id)
    .eq("needs_review", true)
    .select("id");

  if (error) {
    return { error: "Could not save this review. You may not have permission." };
  }

  if (!data || data.length === 0) {
    return { error: "This response is no longer waiting for review." };
  }

  revalidatePath("/admin/review");
  return null;
}
