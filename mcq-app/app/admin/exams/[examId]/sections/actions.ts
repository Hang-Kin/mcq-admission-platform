"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  compactedPositions,
  deletionBlockMessage,
  nextSectionPosition,
  swapWithNeighbor,
  validateSectionFields,
  type SectionPosition,
} from "../../sectionValidation";

export type SectionActionResult = { error?: string } | void;

function revalidateExamSections(examId: string) {
  revalidatePath(`/admin/exams/${examId}/sections`);
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

function fieldsFromForm(formData: FormData) {
  return validateSectionFields({
    label: String(formData.get("label") ?? ""),
    questionSet: String(formData.get("question_set") ?? ""),
    durationMinutes: String(formData.get("duration_minutes") ?? ""),
  });
}

function uniqueSectionError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return true;
  return /duplicate key/i.test(error.message ?? "");
}

async function writePositions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  examId: string,
  updates: SectionPosition[],
) {
  if (updates.length === 0) return null;

  const { data: existing, error: existingError } = await supabase
    .from("exam_sections")
    .select("position")
    .eq("exam_id", examId);

  if (existingError) {
    return "Could not update section order. You may not have permission.";
  }

  let temp =
    Math.max(
      0,
      ...(existing ?? []).map((row: { position: number }) => row.position),
    ) + 1;

  for (const update of updates) {
    const { error } = await supabase
      .from("exam_sections")
      .update({ position: temp })
      .eq("id", update.id)
      .eq("exam_id", examId);
    if (error) {
      return "Could not update section order. You may not have permission.";
    }
    temp += 1;
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("exam_sections")
      .update({ position: update.position })
      .eq("id", update.id)
      .eq("exam_id", examId);
    if (error) {
      return "Could not update section order. You may not have permission.";
    }
  }

  return null;
}

export async function createSection(
  formData: FormData,
): Promise<SectionActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  if (!examId) return { error: "Missing exam." };

  const parsed = fieldsFromForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("exam_sections")
    .select("position")
    .eq("exam_id", examId);

  if (existingError) {
    return { error: "Could not create this section. You may not have permission." };
  }

  const position = nextSectionPosition(
    (existing ?? []).map((row: { position: number }) => row.position),
  );

  const { error } = await supabase.from("exam_sections").insert({
    exam_id: examId,
    position,
    ...parsed.payload,
  });

  if (error) {
    if (uniqueSectionError(error)) {
      return {
        error:
          "A section with that label or position already exists for this exam.",
      };
    }
    return { error: "Could not create this section. You may not have permission." };
  }

  revalidateExamSections(examId);
}

export async function updateSection(
  formData: FormData,
): Promise<SectionActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const sectionId = String(formData.get("section_id") ?? "").trim();
  if (!examId || !sectionId) return { error: "Missing section." };

  const parsed = fieldsFromForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." };
  }

  const { error } = await supabase
    .from("exam_sections")
    .update(parsed.payload)
    .eq("id", sectionId)
    .eq("exam_id", examId);

  if (error) {
    if (uniqueSectionError(error)) {
      return {
        error: "A section with that label already exists for this exam.",
      };
    }
    return { error: "Could not update this section. You may not have permission." };
  }

  revalidateExamSections(examId);
}

export async function moveSection(
  formData: FormData,
): Promise<SectionActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const sectionId = String(formData.get("section_id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  if (!examId || !sectionId) return { error: "Missing section." };
  if (direction !== "up" && direction !== "down") {
    return { error: "Choose whether to move the section up or down." };
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." };
  }

  const { data, error } = await supabase
    .from("exam_sections")
    .select("id, position")
    .eq("exam_id", examId);

  if (error || !data) {
    return { error: "Could not update section order. You may not have permission." };
  }

  const plan = swapWithNeighbor(
    data as SectionPosition[],
    sectionId,
    direction,
  );
  if (!plan.ok) return { error: plan.error };

  const writeError = await writePositions(supabase, examId, plan.updates);
  if (writeError) return { error: writeError };

  revalidateExamSections(examId);
}

export async function deleteSection(
  formData: FormData,
): Promise<SectionActionResult> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const sectionId = String(formData.get("section_id") ?? "").trim();
  if (!examId || !sectionId) return { error: "Missing section." };

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." };
  }

  const role = await currentRole(supabase, user.id);
  if (role !== "admin") {
    return { error: "Only an admin can delete a section." };
  }

  const { data: section, error: sectionError } = await supabase
    .from("exam_sections")
    .select("id, position")
    .eq("id", sectionId)
    .eq("exam_id", examId)
    .maybeSingle();

  if (sectionError || !section) {
    return { error: "This section was not found." };
  }

  const { data: started, error: startedError } = await supabase
    .from("test_instances")
    .select("current_section_index")
    .eq("exam_id", examId)
    .not("started_at", "is", null);

  if (startedError) {
    return {
      error:
        "Could not check whether students have started this exam, so the section was not deleted.",
    };
  }

  const block = deletionBlockMessage(
    (started ?? []).map(
      (row: { current_section_index: number | null }) =>
        row.current_section_index,
    ),
    section.position,
  );
  if (block) return { error: block };

  const { error } = await supabase
    .from("exam_sections")
    .delete()
    .eq("id", sectionId)
    .eq("exam_id", examId);

  if (error) {
    return { error: "Could not delete this section. You may not have permission." };
  }

  const { data: remaining, error: remainingError } = await supabase
    .from("exam_sections")
    .select("id, position")
    .eq("exam_id", examId);

  if (remainingError || !remaining) {
    revalidateExamSections(examId);
    return {
      error:
        "The section was deleted, but the remaining order could not be updated. Refresh and check the list.",
    };
  }

  const writeError = await writePositions(
    supabase,
    examId,
    compactedPositions(remaining as SectionPosition[]),
  );
  if (writeError) {
    revalidateExamSections(examId);
    return { error: writeError };
  }

  revalidateExamSections(examId);
}
