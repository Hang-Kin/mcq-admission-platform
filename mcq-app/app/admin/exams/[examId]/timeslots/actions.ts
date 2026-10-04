"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  cellsFromFormEntries,
  planSectionTimeslotQuestionSets,
} from "../../sectionTimeslotOverrides";
import {
  isUniqueLabelError,
  validateTimeslotFields,
} from "../../timeslotValidation";

export type TimeslotActionResult = { error?: string } | void;

function revalidateExamTimeslots(examId: string) {
  revalidatePath(`/admin/exams/${examId}/timeslots`);
  revalidatePath("/admin/exams");
}

function uniqueLabelError(): TimeslotActionResult {
  return {
    error: "A timeslot with that label already exists for this exam.",
  };
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

function fieldsFromForm(formData: FormData) {
  return validateTimeslotFields({
    label: String(formData.get("label") ?? ""),
    questionSet: String(formData.get("question_set") ?? ""),
    startsAt: String(formData.get("starts_at") ?? ""),
    endsAt: String(formData.get("ends_at") ?? ""),
  });
}

export async function createTimeslot(
  formData: FormData,
): Promise<TimeslotActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  if (!examId) {
    return { error: "Missing exam." };
  }

  const parsed = fieldsFromForm(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." };
  }

  const { error } = await supabase.from("timeslots").insert({
    exam_id: examId,
    ...parsed.payload,
  });

  if (error) {
    if (isUniqueLabelError(error)) return uniqueLabelError();
    return { error: "Could not create this timeslot. You may not have permission." };
  }

  revalidateExamTimeslots(examId);
}

export async function updateTimeslot(
  formData: FormData,
): Promise<TimeslotActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const timeslotId = String(formData.get("timeslot_id") ?? "").trim();
  if (!examId || !timeslotId) {
    return { error: "Missing timeslot." };
  }

  const parsed = fieldsFromForm(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." };
  }

  const { error } = await supabase
    .from("timeslots")
    .update(parsed.payload)
    .eq("id", timeslotId)
    .eq("exam_id", examId);

  if (error) {
    if (isUniqueLabelError(error)) return uniqueLabelError();
    return { error: "Could not update this timeslot. You may not have permission." };
  }

  revalidateExamTimeslots(examId);
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

export async function setTimeslotOverride(
  formData: FormData,
): Promise<TimeslotActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const raw = String(formData.get("active_timeslot_override") ?? "").trim();
  if (!examId) {
    return { error: "Missing exam." };
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." };
  }

  const override: string | null = raw.length > 0 ? raw : null;

  if (override) {
    const { data: slot, error: slotError } = await supabase
      .from("timeslots")
      .select("id")
      .eq("id", override)
      .eq("exam_id", examId)
      .maybeSingle();

    if (slotError || !slot) {
      return { error: "Choose a timeslot that belongs to this exam." };
    }
  }

  const { error } = await supabase
    .from("exams")
    .update({ active_timeslot_override: override })
    .eq("id", examId);

  if (error) {
    return {
      error: "Could not update the override. You may not have permission.",
    };
  }

  revalidateExamTimeslots(examId);
}

export async function saveSectionTimeslotQuestionSets(
  formData: FormData,
): Promise<TimeslotActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  if (!examId) {
    return { error: "Missing exam." };
  }

  const entries: [string, string][] = [];
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") {
      return { error: "A section question set was not submitted correctly." };
    }
    entries.push([key, value]);
  }

  const cells = cellsFromFormEntries(entries);
  if ("error" in cells) return cells;

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." };
  }

  const [
    { data: timeslotRows, error: timeslotError },
    { data: sectionRows, error: sectionError },
    { data: existingRows, error: existingError },
  ] = await Promise.all([
    supabase.from("timeslots").select("id").eq("exam_id", examId),
    supabase.from("exam_sections").select("id").eq("exam_id", examId),
    supabase
      .from("section_timeslot_question_sets")
      .select("timeslot_id, section_id, question_set")
      .eq("exam_id", examId),
  ]);

  if (timeslotError || sectionError || existingError || !timeslotRows || !sectionRows) {
    return {
      error:
        "Could not save these section question sets. Apply migration 016 if that table is not set up yet.",
    };
  }

  const timeslotIds = new Set(timeslotRows.map((row) => row.id));
  const sectionIds = new Set(sectionRows.map((row) => row.id));
  if (
    cells.some(
      (cell) =>
        !timeslotIds.has(cell.timeslotId) || !sectionIds.has(cell.sectionId),
    )
  ) {
    return { error: "Choose timeslots and sections that belong to this exam." };
  }

  const plan = planSectionTimeslotQuestionSets(
    cells,
    (existingRows ?? []).map((row) => ({
      timeslotId: row.timeslot_id,
      sectionId: row.section_id,
      questionSet: row.question_set,
    })),
  );

  if (plan.clears.length > 0) {
    const role = await currentRole(supabase, user.id);
    if (role !== "admin") {
      return {
        error:
          "Only an admin can clear a section's question set for a timeslot.",
      };
    }
  }

  for (const row of plan.upserts) {
    const { error } = await supabase
      .from("section_timeslot_question_sets")
      .upsert(
        {
          exam_id: examId,
          timeslot_id: row.timeslotId,
          section_id: row.sectionId,
          question_set: row.questionSet,
        },
        { onConflict: "timeslot_id,section_id" },
      );
    if (error) {
      return {
        error:
          "Could not save these section question sets. You may not have permission.",
      };
    }
  }

  for (const row of plan.clears) {
    const { error } = await supabase
      .from("section_timeslot_question_sets")
      .delete()
      .eq("exam_id", examId)
      .eq("timeslot_id", row.timeslotId)
      .eq("section_id", row.sectionId);
    if (error) {
      return {
        error:
          "Could not clear a section question set. You may not have permission.",
      };
    }
  }

  revalidateExamTimeslots(examId);
}
