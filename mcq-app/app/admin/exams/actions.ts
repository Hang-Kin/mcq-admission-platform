"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { validateExamFields } from "./examValidation";

export type CreateExamResult = { error?: string } | void;

const STAFF_ROLES = ["admin", "teacher"];

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "You are not signed in. Refresh and log in again.",
    } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "";
  if (!STAFF_ROLES.includes(role)) {
    return { error: "You do not have permission to create exams." } as const;
  }

  return { supabase } as const;
}

export async function createExam(formData: FormData): Promise<CreateExamResult> {
  const parsed = validateExamFields({
    name: String(formData.get("name") ?? ""),
    durationMinutes: String(formData.get("duration_minutes") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireStaff();
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase
    .from("exams")
    .insert({
      name: parsed.payload.name,
      duration_minutes: parsed.payload.duration_minutes,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error: "Could not create this exam. You may not have permission.",
    };
  }

  revalidatePath("/admin/exams");
  redirect(`/admin/exams/${data.id}/sections`);
}
