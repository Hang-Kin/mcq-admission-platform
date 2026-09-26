"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { assignedCountOf, scoreResponses } from "../../gradeScore";

export type GradeActionState = { error?: string; message?: string } | null;

async function requireAdmin() {
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
  if (profile?.role !== "admin") {
    return { error: "Only an admin can change grades." } as const;
  }
  return { supabase, user } as const;
}

function revalidateGrades(examId: string, instanceId: string) {
  revalidatePath(`/admin/exams/${examId}/grades`);
  revalidatePath(`/admin/exams/${examId}/grades/${instanceId}`);
  revalidatePath("/admin/review");
}

export async function correctResponse(
  _prev: GradeActionState,
  formData: FormData,
): Promise<GradeActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const examId = String(formData.get("exam_id") ?? "").trim();
  const instanceId = String(formData.get("instance_id") ?? "").trim();
  const verdict = String(formData.get("verdict") ?? "").trim();

  if (!id || !examId || !instanceId) {
    return { error: "Missing response." };
  }
  if (verdict !== "correct" && verdict !== "incorrect") {
    return { error: "Choose mark correct or mark incorrect." };
  }

  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase
    .from("responses")
    .update({
      is_correct: verdict === "correct",
      graded_by: "manual",
      needs_review: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user.id,
    })
    .eq("id", id)
    .eq("test_instance_id", instanceId)
    .select("id");

  if (error) {
    return { error: "Could not save this correction. You may not have permission." };
  }
  if (!data || data.length === 0) {
    return { error: "This response was not found for this student." };
  }

  revalidateGrades(examId, instanceId);
  return null;
}

export async function finalizeGrade(
  _prev: GradeActionState,
  formData: FormData,
): Promise<GradeActionState> {
  const examId = String(formData.get("exam_id") ?? "").trim();
  const instanceId = String(formData.get("instance_id") ?? "").trim();
  if (!examId || !instanceId) {
    return { error: "Missing student sitting." };
  }

  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const { data: instance, error: instanceError } = await auth.supabase
    .from("test_instances")
    .select("id, student_id, exam_id, status, assigned_question_ids")
    .eq("id", instanceId)
    .eq("exam_id", examId)
    .single();

  if (instanceError || !instance) {
    return { error: "This student sitting was not found." };
  }
  if (instance.status !== "submitted") {
    return { error: "Only submitted exams can be finalized." };
  }

  const { data: responses, error: responsesError } = await auth.supabase
    .from("responses")
    .select("is_correct, needs_review")
    .eq("test_instance_id", instanceId);

  if (responsesError) {
    return { error: "Could not load responses. Try again." };
  }

  const score = scoreResponses(
    responses ?? [],
    assignedCountOf(instance.assigned_question_ids),
  );

  if (score.pendingReview > 0) {
    return {
      error: `${score.pendingReview} response${score.pendingReview === 1 ? " still needs" : "s still need"} review. Mark ${score.pendingReview === 1 ? "it" : "them"} correct or incorrect before finalizing.`,
    };
  }
  if (score.percent === null) {
    return { error: "This student has no questions to grade." };
  }

  const { error: upsertError } = await auth.supabase.from("grades").upsert(
    {
      student_id: instance.student_id,
      exam_id: instance.exam_id,
      final_grade: score.percent,
      finalized_at: new Date().toISOString(),
    },
    { onConflict: "student_id,exam_id" },
  );

  if (upsertError) {
    return { error: "Could not save the final grade. You may not have permission." };
  }

  revalidateGrades(examId, instanceId);
  return { message: `Finalized at ${score.percent}%.` };
}
