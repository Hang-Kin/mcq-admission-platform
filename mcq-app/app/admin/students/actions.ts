"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CreateStudentResult = { error?: string } | void;

export async function createStudent(
  formData: FormData,
): Promise<CreateStudentResult> {
  const name = String(formData.get("name") ?? "").trim();
  const application_number = String(
    formData.get("application_number") ?? "",
  ).trim();

  if (!name) {
    return { error: "Name is required." };
  }

  if (!application_number) {
    return { error: "Application number is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    name,
    application_number,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "That application number is already in the roster.",
      };
    }

    return {
      error: "Could not add this student. You may not have permission.",
    };
  }

  revalidatePath("/admin/students");
}
