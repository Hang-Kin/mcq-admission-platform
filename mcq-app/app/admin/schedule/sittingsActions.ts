"use server";

import { revalidatePath } from "next/cache";

import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

import { validateExamFields } from "../exams/examValidation";
import { isUniqueLabelError } from "../exams/timeslotValidation";
import {
  earliestSectionPlan,
  slotLengthError,
  subjectMinutesFromRows,
  totalExamMinutes,
} from "../settings/sectionMinutes";
import { labels } from "./labels";
import { isMissingSchema, parseSittingId } from "./scheduleModel";
import {
  canConfirmDelete,
  clashMessage,
  countStudents,
  deleteTestDataSummary,
  type SittingWindow,
} from "./sittingRules";
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

async function examMinutesFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  examId: string,
): Promise<{ minutes: number } | { error: string }> {
  const [sectionsResult, settingsResult, startedResult, plansResult] = await Promise.all([
    supabase
      .from("exam_sections")
      .select("subject, position, duration_minutes")
      .eq("exam_id", examId),
    supabase.from("subject_settings").select("subject, duration_minutes"),
    supabase
      .from("test_instances")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId)
      .not("started_at", "is", null),
    supabase
      .from("test_instances")
      .select("started_at, section_plan")
      .eq("exam_id", examId)
      .not("started_at", "is", null)
      .order("started_at", { ascending: true })
      .limit(1),
  ]);

  if (sectionsResult.error) {
    if (isMissingSchema(sectionsResult.error)) return { minutes: 0 };
    return { error: "Could not check how long this exam is." };
  }
  const sections = sectionsResult.data ?? [];
  if (sections.length === 0) return { minutes: 0 };

  if (startedResult.error && !isMissingSchema(startedResult.error)) {
    return { error: "Could not check whether a student has started." };
  }
  const started = !startedResult.error && (startedResult.count ?? 0) > 0;

  let settings = null;
  if (!started) {
    if (settingsResult.error) {
      if (!isMissingSchema(settingsResult.error)) {
        return { error: "Could not read the minutes for Math and Chinese." };
      }
    } else {
      settings = subjectMinutesFromRows(
        (settingsResult.data ?? []).map((row) => ({
          subject: row.subject == null ? null : String(row.subject),
          durationMinutes: Number(row.duration_minutes),
        })),
      );
    }
  }

  let plan: unknown = null;
  if (started) {
    if (plansResult.error) {
      if (!isMissingSchema(plansResult.error)) {
        return { error: "Could not read the fixed minutes for this exam." };
      }
    } else {
      plan = earliestSectionPlan(
        (plansResult.data ?? []).map((row) => ({
          startedAt: row.started_at == null ? null : String(row.started_at),
          plan: row.section_plan,
        })),
      );
    }
  }

  return {
    minutes: totalExamMinutes({
      sections: sections.map((row) => ({
        subject: row.subject == null ? null : String(row.subject),
        position: Number(row.position),
        durationMinutes: Number(row.duration_minutes),
      })),
      settings,
      started,
      plan,
    }),
  };
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

  const length = await examMinutesFor(auth.supabase, examId);
  if ("error" in length) return { error: length.error };
  const lengthError = slotLengthError(
    Date.parse(parsed.startsAt),
    Date.parse(parsed.endsAt),
    length.minutes,
  );
  if (lengthError) return { error: lengthError };

  const clash = await clashForExam(auth.supabase, examId, parsed);
  if (clash) return { error: clash };

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

  const linked = await linkedInstanceCounts(auth.supabase, sittingId);
  if ("error" in linked) return { error: linked.error };
  if (linked.started > 0) return { error: labels.startedCannotDelete };
  if (linked.total > 0) return { error: labels.linkedCannotDelete };

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

async function loadWindows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  examId: string,
): Promise<{ windows: SittingWindow[] } | { error: string }> {
  const withArchive = await supabase
    .from("timeslots")
    .select("id, label, starts_at, ends_at, archived_at")
    .eq("exam_id", examId);
  if (!withArchive.error) {
    return { windows: windowsFrom(withArchive.data ?? [], true) };
  }
  if (!isMissingSchema(withArchive.error)) {
    return { error: labels.couldNotCheckTimes };
  }
  const plain = await supabase
    .from("timeslots")
    .select("id, label, starts_at, ends_at")
    .eq("exam_id", examId);
  if (plain.error) return { error: labels.couldNotCheckTimes };
  return { windows: windowsFrom(plain.data ?? [], false) };
}

function windowsFrom(
  rows: Array<{
    id: string;
    label: string | null;
    starts_at: string | null;
    ends_at: string | null;
    archived_at?: string | null;
  }>,
  keepArchive: boolean,
): SittingWindow[] {
  return rows.map((row) => ({
    id: String(row.id),
    label: String(row.label ?? "").trim() || "Sitting",
    startsAt: row.starts_at == null ? "" : String(row.starts_at),
    endsAt: row.ends_at == null ? "" : String(row.ends_at),
    archivedAt: keepArchive && row.archived_at ? String(row.archived_at) : null,
  }));
}

async function clashForExam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  examId: string,
  candidate: { startsAt: string; endsAt: string },
  ignoreId?: string,
): Promise<string | null> {
  const loaded = await loadWindows(supabase, examId);
  if ("error" in loaded) return loaded.error;
  return clashMessage(candidate, loaded.windows, ignoreId);
}

async function linkedInstanceCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sittingId: string,
): Promise<{ total: number; started: number } | { error: string }> {
  const [totalResult, startedResult] = await Promise.all([
    supabase
      .from("test_instances")
      .select("id", { count: "exact", head: true })
      .eq("timeslot_id", sittingId),
    supabase
      .from("test_instances")
      .select("id", { count: "exact", head: true })
      .eq("timeslot_id", sittingId)
      .not("started_at", "is", null),
  ]);
  if (totalResult.error || startedResult.error) {
    return { error: "Could not check whether a student has started." };
  }
  return { total: totalResult.count ?? 0, started: startedResult.count ?? 0 };
}

export async function updateSittingTime(formData: FormData): Promise<ActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const sittingId = parseSittingId(String(formData.get("sitting_id") ?? ""));
  if (!examId || !sittingId) return { error: labels.sittingMissing };

  const parsed = validateSittingTime({
    label: String(formData.get("label") ?? ""),
    startsAt: String(formData.get("starts_at") ?? ""),
    endsAt: String(formData.get("ends_at") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const auth = await requireStaff("You do not have permission to change a time.");
  if ("error" in auth) return { error: auth.error };

  const linked = await linkedInstanceCounts(auth.supabase, sittingId);
  if ("error" in linked) return { error: linked.error };
  if (linked.started > 0) return { error: labels.timeStays };

  const length = await examMinutesFor(auth.supabase, examId);
  if ("error" in length) return { error: length.error };
  const lengthError = slotLengthError(
    Date.parse(parsed.startsAt),
    Date.parse(parsed.endsAt),
    length.minutes,
  );
  if (lengthError) return { error: lengthError };

  const clash = await clashForExam(auth.supabase, examId, parsed, sittingId);
  if (clash) return { error: clash };

  const { error } = await auth.supabase
    .from("timeslots")
    .update({
      label: parsed.label,
      starts_at: parsed.startsAt,
      ends_at: parsed.endsAt,
    })
    .eq("id", sittingId)
    .eq("exam_id", examId);
  if (error) {
    if (isUniqueLabelError(error)) {
      return { error: "A time with that name already exists for this exam." };
    }
    return { error: "Could not save this time. You may not have permission." };
  }

  refresh(examId);
}

export async function setSittingArchived(formData: FormData): Promise<ActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const sittingId = parseSittingId(String(formData.get("sitting_id") ?? ""));
  if (!examId || !sittingId) return { error: labels.sittingMissing };
  const archived = String(formData.get("archived") ?? "") === "1";

  const auth = await requireStaff(
    archived
      ? "You do not have permission to archive a sitting."
      : "You do not have permission to restore a sitting.",
  );
  if ("error" in auth) return { error: auth.error };

  const { data: slot, error: slotError } = await auth.supabase
    .from("timeslots")
    .select("id")
    .eq("id", sittingId)
    .eq("exam_id", examId)
    .maybeSingle();
  if (slotError || !slot) return { error: labels.sittingMissing };

  if (archived) {
    const { data: exam, error: examError } = await auth.supabase
      .from("exams")
      .select("active_timeslot_override")
      .eq("id", examId)
      .maybeSingle();
    if (examError || !exam) return { error: labels.archiveFailed };
    if (exam.active_timeslot_override === sittingId) {
      const { error: clearError } = await auth.supabase
        .from("exams")
        .update({ active_timeslot_override: null })
        .eq("id", examId);
      if (clearError) return { error: labels.archiveFailed };
    }
  }

  const { error } = await auth.supabase
    .from("timeslots")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", sittingId)
    .eq("exam_id", examId);
  if (error) {
    if (isMissingSchema(error)) return { error: labels.archiveWaiting };
    return { error: archived ? labels.archiveFailed : labels.restoreFailed };
  }

  refresh(examId);
}

async function requireAdmin(denied: string) {
  const auth = await requireStaff(denied);
  if ("error" in auth) return auth;
  if (auth.role !== "admin") return { error: labels.adminOnlyDelete } as const;
  return auth;
}

export async function previewSittingDeletion(
  formData: FormData,
): Promise<{ error?: string; summary?: string }> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const sittingId = parseSittingId(String(formData.get("sitting_id") ?? ""));
  if (!examId || !sittingId) return { error: labels.sittingMissing };

  const auth = await requireAdmin(labels.adminOnlyDelete);
  if ("error" in auth) return { error: auth.error };

  const counts = await deletionCounts(auth.supabase, examId, sittingId);
  if ("error" in counts) return { error: counts.error };
  return { summary: deleteTestDataSummary(counts) };
}

export async function deleteSittingTestData(formData: FormData): Promise<ActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const sittingId = parseSittingId(String(formData.get("sitting_id") ?? ""));
  const confirm = String(formData.get("confirm") ?? "");
  if (!examId || !sittingId) return { error: labels.sittingMissing };
  if (!canConfirmDelete(confirm)) return { error: labels.deleteWordMismatch };

  const auth = await requireAdmin(labels.adminOnlyDelete);
  if ("error" in auth) return { error: auth.error };

  const { data: slot, error: slotError } = await auth.supabase
    .from("timeslots")
    .select("id")
    .eq("id", sittingId)
    .eq("exam_id", examId)
    .maybeSingle();
  if (slotError || !slot) return { error: labels.sittingMissing };

  const { data, error } = await auth.supabase.rpc("delete_sitting_test_data", {
    p_timeslot_id: sittingId,
    p_confirm: confirm,
  });
  if (error) {
    if (isMissingSchema(error)) return { error: labels.deleteWaiting };
    return { error: labels.deleteFailed };
  }
  const result = readDeleteResult(data);
  if (!result.ok) return { error: result.error };

  refresh(examId);
}

async function deletionCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  examId: string,
  sittingId: string,
): Promise<{ students: number; answers: number; results: number } | { error: string }> {
  const { data: slot, error: slotError } = await supabase
    .from("timeslots")
    .select("id")
    .eq("id", sittingId)
    .eq("exam_id", examId)
    .maybeSingle();
  if (slotError || !slot) return { error: labels.sittingMissing };

  const { data: instances, error: instanceError } = await supabase
    .from("test_instances")
    .select("id, student_id")
    .eq("timeslot_id", sittingId);
  if (instanceError) return { error: labels.deleteCountFailed };

  const rows = instances ?? [];
  const students = countStudents(
    rows.map((row) => ({
      studentId: row.student_id == null ? null : String(row.student_id),
    })),
  );
  const instanceIds = rows.map((row) => String(row.id));
  const studentIds = [
    ...new Set(
      rows
        .map((row) => (row.student_id == null ? "" : String(row.student_id)))
        .filter((id) => id.length > 0),
    ),
  ];

  let answers = 0;
  if (instanceIds.length > 0) {
    const { count, error } = await supabase
      .from("responses")
      .select("id", { count: "exact", head: true })
      .in("test_instance_id", instanceIds);
    if (error) return { error: labels.deleteCountFailed };
    answers = count ?? 0;
  }

  let results = 0;
  if (studentIds.length > 0) {
    const { count, error } = await supabase
      .from("grades")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId)
      .in("student_id", studentIds);
    if (error) return { error: labels.deleteCountFailed };
    results = count ?? 0;
  }

  return { students, answers, results };
}

function readDeleteResult(data: unknown): { ok: true } | { ok: false; error: string } {
  if (!data || typeof data !== "object") return { ok: false, error: labels.deleteFailed };
  const record = data as { ok?: unknown; error?: unknown };
  if (record.ok === true) return { ok: true };
  if (record.error === "not_admin") return { ok: false, error: labels.adminOnlyDelete };
  if (record.error === "confirm_delete") return { ok: false, error: labels.deleteWordMismatch };
  if (record.error === "timeslot_not_found") return { ok: false, error: labels.sittingMissing };
  return { ok: false, error: labels.deleteFailed };
}
