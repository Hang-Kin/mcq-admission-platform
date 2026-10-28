"use server";

import { revalidatePath } from "next/cache";

import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

import {
  parsePositiveInteger,
  settingsWriteError,
  SUBJECTS,
  type SubjectId,
} from "./subjectSettings";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isStaffRole(profile?.role)) {
    return { error: "You do not have permission to change these settings." } as const;
  }

  return { supabase } as const;
}

export async function saveSubjectSettings(formData: FormData) {
  const rows: Array<{
    subject: SubjectId;
    questions_per_category: number;
    duration_minutes: number;
  }> = [];

  for (const subject of SUBJECTS) {
    const questions = parsePositiveInteger(
      String(formData.get(`${subject}-questions`) ?? ""),
      `${subject} questions per topic`,
    );
    if (!questions.ok) return { error: questions.error };

    const minutes = parsePositiveInteger(
      String(formData.get(`${subject}-minutes`) ?? ""),
      `${subject} time`,
    );
    if (!minutes.ok) return { error: minutes.error };

    rows.push({
      subject,
      questions_per_category: questions.value,
      duration_minutes: minutes.value,
    });
  }

  const auth = await requireStaff();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.from("subject_settings").upsert(rows, {
    onConflict: "subject",
  });

  if (error) return { error: settingsWriteError(error.message) };

  revalidatePath("/admin/settings");
  revalidatePath("/admin/bank");
}
