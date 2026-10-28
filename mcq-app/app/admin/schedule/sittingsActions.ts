"use server";

import { revalidatePath } from "next/cache";

import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

import { validateExamFields } from "../exams/examValidation";
import { isUniqueLabelError } from "../exams/timeslotValidation";
import { isMissingSchema, parseSittingId } from "./scheduleModel";
import { validateSittingTime } from "./sittingsFlow";

const SUBJECTS = ["Math", "Chinese"] as const;
const DEFAULT_MINUTES: { Math: number; Chinese: number } = { Math: 7, Chinese: 8 };
const WAITING =
  "Preparing questions is waiting for a database update. Nothing was changed.";

type ActionResult = { error?: string } | void;

async function requireStaff(denied: string) {
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
    return { error: denied } as const;
  }
  return { supabase, userId: user.id, role: profile?.role ?? "" } as const;
}

function refresh(examId?: string) {
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
  revalidatePath("/admin/exams");
  if (examId) revalidatePath(`/admin/exams/${examId}/timeslots`);
}

async function subjectMinutes(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ Math: number; Chinese: number } | { error: string }> {
  const { data, error } = await supabase
    .from("subject_settings")
    .select("subject, duration_minutes");
  if (error) {
    if (isMissingSchema(error)) return { error: WAITING };
    return { error: "Could not read the minutes for Math and Chinese." };
  }
  const minutes = { ...DEFAULT_MINUTES };
  for (const row of data ?? []) {
    const subject = String(row.subject ?? "");
    const value = Number(row.duration_minutes);
    if ((subject === "Math" || subject === "Chinese") && Number.isInteger(value) && value > 0) {
      minutes[subject] = value;
    }
  }
  return minutes;
}

async function subjectsAvailable(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { error } = await supabase.from("exam_sections").select("subject").limit(1);
  if (!error) return null;
  if (isMissingSchema(error)) return WAITING;
  return "Could not check Math and Chinese. You may not have permission.";
}

async function ensureSubject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  examId: string,
  subject: (typeof SUBJECTS)[number],
  minutes: number,
) {
  const { data, error } = await supabase
    .from("exam_sections")
    .select("id, label, subject, position")
    .eq("exam_id", examId);
  if (error) {
    if (isMissingSchema(error)) return WAITING;
    return "Could not add Math and Chinese. You may not have permission.";
  }
  const rows = data ?? [];
  const existing = rows.find((row) => row.subject === subject || row.label === subject);
  if (existing) {
    if (existing.subject === subject) return null;
    const { error: updateError } = await supabase
      .from("exam_sections")
      .update({ subject })
      .eq("id", existing.id)
      .eq("exam_id", examId);
    return updateError ? "Could not add Math and Chinese. You may not have permission." : null;
  }
  const position = rows.reduce((max, row) => Math.max(max, Number(row.position) || 0), -1) + 1;
  const { error: insertError } = await supabase.from("exam_sections").insert({
    exam_id: examId,
    position,
    label: subject,
    subject,
    question_set: subject,
    duration_minutes: minutes,
  });
  if (!insertError) return null;
  if (isMissingSchema(insertError)) return WAITING;
  return "Could not add Math and Chinese. You may not have permission.";
}

export async function createNamedExam(formData: FormData): Promise<ActionResult> {
  const auth = await requireStaff("You do not have permission to create an exam.");
  if ("error" in auth) return { error: auth.error };

  const blocked = await subjectsAvailable(auth.supabase);
  if (blocked) return { error: blocked };

  const minutes = await subjectMinutes(auth.supabase);
  if ("error" in minutes) return { error: minutes.error };

  const parsed = validateExamFields({
    name: String(formData.get("name") ?? ""),
    durationMinutes: String(minutes.Math + minutes.Chinese),
  });
  if (!parsed.ok) return { error: parsed.error };

  const { data, error } = await auth.supabase
    .from("exams")
    .insert({
      name: parsed.payload.name,
      duration_minutes: parsed.payload.duration_minutes,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: "Could not create this exam. You may not have permission." };
  }

  for (const subject of SUBJECTS) {
    const subjectError = await ensureSubject(auth.supabase, data.id, subject, minutes[subject]);
    if (subjectError) {
      await auth.supabase.from("exams").delete().eq("id", data.id);
      return { error: subjectError };
    }
  }

  refresh(data.id);
}

export async function addMathAndChinese(formData: FormData): Promise<ActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  if (!examId) return { error: "Choose an exam first." };

  const auth = await requireStaff("You do not have permission to change this exam.");
  if ("error" in auth) return { error: auth.error };

  const minutes = await subjectMinutes(auth.supabase);
  if ("error" in minutes) return { error: minutes.error };

  for (const subject of SUBJECTS) {
    const subjectError = await ensureSubject(auth.supabase, examId, subject, minutes[subject]);
    if (subjectError) return { error: subjectError };
  }

  refresh(examId);
}

export async function addSittingTime(formData: FormData): Promise<ActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  if (!examId) return { error: "Choose an exam first." };

  const parsed = validateSittingTime({
    label: String(formData.get("label") ?? ""),
    startsAt: String(formData.get("starts_at") ?? ""),
    endsAt: String(formData.get("ends_at") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const auth = await requireStaff("You do not have permission to add a time.");
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.from("timeslots").insert({
    exam_id: examId,
    label: parsed.label,
    starts_at: parsed.startsAt,
    ends_at: parsed.endsAt,
    question_set: "Math",
  });
  if (error) {
    if (isUniqueLabelError(error)) {
      return { error: "A time with that name already exists for this exam." };
    }
    return { error: "Could not add this time. You may not have permission." };
  }

  refresh(examId);
}

export async function deleteSittingTime(formData: FormData): Promise<ActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const sittingId = parseSittingId(String(formData.get("sitting_id") ?? ""));
  if (!examId || !sittingId) return { error: "This time could not be found." };

  const auth = await requireStaff("You do not have permission to delete a time.");
  if ("error" in auth) return { error: auth.error };
  if (auth.role !== "admin") return { error: "Only an admin can delete a time." };

  const { data: exam, error: examError } = await auth.supabase
    .from("exams")
    .select("id, active_timeslot_override")
    .eq("id", examId)
    .single();
  if (examError || !exam) return { error: "This exam was not found." };

  if (exam.active_timeslot_override === sittingId) {
    const { error: clearError } = await auth.supabase
      .from("exams")
      .update({ active_timeslot_override: null })
      .eq("id", examId);
    if (clearError) return { error: "Could not delete this time." };
  }

  const { error } = await auth.supabase
    .from("timeslots")
    .delete()
    .eq("id", sittingId)
    .eq("exam_id", examId);
  if (error) return { error: "Could not delete this time." };

  refresh(examId);
}
