"use server";

import { revalidatePath } from "next/cache";

import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

import {
  isMissingSchema,
  parsePositiveInteger,
  settingsWriteError,
  SUBJECTS,
  type SubjectId,
} from "./subjectSettings";
import { sectionMinuteUpdates, subjectMinutesFromRows } from "./sectionMinutes";

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

  const [sectionsResult, startedResult] = await Promise.all([
    auth.supabase.from("exam_sections").select("id, exam_id, subject, duration_minutes"),
    auth.supabase.from("test_instances").select("exam_id").not("started_at", "is", null),
  ]);

  if (!isMissingSchema(sectionsResult.error) && !sectionsResult.error) {
    if (startedResult.error && !isMissingSchema(startedResult.error)) {
      revalidatePath("/admin/settings");
      revalidatePath("/admin/bank");
      return {
        error: "Subject settings were saved, but the exam sections could not be updated.",
      };
    }
    const updates = sectionMinuteUpdates({
      sections: (sectionsResult.data ?? []).map((row) => ({
        id: String(row.id),
        examId: String(row.exam_id),
        subject: row.subject == null ? null : String(row.subject),
        durationMinutes: Number(row.duration_minutes),
      })),
      startedExamIds: (startedResult.data ?? [])
        .map((row) => (row.exam_id == null ? "" : String(row.exam_id)))
        .filter((id) => id.length > 0),
      settings: subjectMinutesFromRows(
        rows.map((row) => ({ subject: row.subject, durationMinutes: row.duration_minutes })),
      ),
    });
    const examIds = new Set<string>();
    for (const update of updates) {
      const { error: updateError } = await auth.supabase
        .from("exam_sections")
        .update({ duration_minutes: update.durationMinutes })
        .eq("id", update.id);
      if (updateError) {
        revalidatePath("/admin/settings");
        revalidatePath("/admin/bank");
        revalidatePath("/admin/schedule");
        return {
          error: "Subject settings were saved, but the exam sections could not be updated.",
        };
      }
      examIds.add(update.examId);
    }
    for (const examId of examIds) {
      revalidatePath(`/admin/exams/${examId}/sections`);
    }
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/bank");
  revalidatePath("/admin/schedule");
}
