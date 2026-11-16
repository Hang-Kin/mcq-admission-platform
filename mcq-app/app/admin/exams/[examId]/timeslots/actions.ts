"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type TimeslotActionResult = { error?: string } | void;

function revalidateExamTimeslots(examId: string) {
  revalidatePath(`/admin/exams/${examId}/timeslots`);
  revalidatePath("/admin/exams");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function currentRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role ?? "";
}

export async function deleteTimeslot(
  formData: FormData,
): Promise<TimeslotActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const timeslotId = String(formData.get("timeslot_id") ?? "").trim();
  if (!examId || !timeslotId) {
    return { error: "Missing timeslot." };
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." };
  }

  const role = await currentRole(supabase, user.id);
  if (role !== "admin") {
    return { error: "Only an admin can delete a timeslot." };
  }

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, active_timeslot_override")
    .eq("id", examId)
    .single();

  if (examError || !exam) {
    return { error: "This exam was not found." };
  }

  if (exam.active_timeslot_override === timeslotId) {
    const { error: clearError } = await supabase
      .from("exams")
      .update({ active_timeslot_override: null })
      .eq("id", examId);

    if (clearError) {
      return {
        error: "Could not clear the manual override before deleting this timeslot.",
      };
    }
  }

  const { error } = await supabase
    .from("timeslots")
    .delete()
    .eq("id", timeslotId)
    .eq("exam_id", examId);

  if (error) {
    return { error: "Could not delete this timeslot. You may not have permission." };
  }

  revalidateExamTimeslots(examId);
}
