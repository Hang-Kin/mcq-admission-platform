"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { assignedCountOf, scoreResponses } from "../../gradeScore";
import { labels } from "../../../results/labels";
import { isMissingMarking } from "../../../results/markSchema";
import { rpcOverride } from "../../../results/markRpc";
import { scoreRow } from "../../../results/marking";
import { UUID_RE } from "../../../results/ids";

export type GradeActionState = { error?: string; message?: string } | null;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: labels.signIn } as const;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { error: labels.adminOnly } as const;
  }
  return { supabase, user } as const;
}

function revalidateGrades(examId: string, instanceId: string) {
  revalidatePath(`/admin/exams/${examId}/grades`);
  revalidatePath(`/admin/exams/${examId}/grades/${instanceId}`);
  revalidatePath("/admin/review");
  revalidatePath(`/admin/review/${instanceId}`);
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
    return { error: labels.missingResponse };
  }
  if (verdict !== "correct" && verdict !== "incorrect") {
    return { error: labels.chooseVerdict };
  }

  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  if (UUID_RE.test(id)) {
    const marked = await rpcOverride(auth.supabase, id, verdict === "correct", "");
    if (marked.ok) {
      revalidateGrades(examId, instanceId);
      return null;
    }
    if (marked.code !== "waiting") {
      return { error: labels.couldNotSaveMark };
    }
  }

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
    return { error: labels.couldNotSaveMark };
  }
  if (!data || data.length === 0) {
    return { error: labels.responseMissing };
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
    return { error: labels.missingSitting };
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
    return { error: labels.sittingMissing };
  }
  if (instance.status !== "submitted") {
    return { error: labels.submittedOnly };
  }

  const withMarks = await auth.supabase
    .from("responses")
    .select("is_correct, needs_review, response_marks ( state, override_is_correct, system_mark_known )")
    .eq("test_instance_id", instanceId);
  const loadedResponses =
    withMarks.error && isMissingMarking(withMarks.error)
      ? await auth.supabase
          .from("responses")
          .select("is_correct, needs_review")
          .eq("test_instance_id", instanceId)
      : withMarks;

  if (loadedResponses.error) {
    return { error: labels.couldNotLoadResponses };
  }

  const score = scoreResponses(
    (loadedResponses.data ?? []).map((row) => scoreRow(row)),
    assignedCountOf(instance.assigned_question_ids),
  );

  if (score.pendingReview > 0) {
    return { error: labels.pendingFinalize(score.pendingReview) };
  }
  if (score.percent === null) {
    return { error: labels.noQuestionsToGrade };
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
    return { error: labels.couldNotSaveGrade };
  }

  revalidateGrades(examId, instanceId);
  return { message: labels.finalizedAt(score.percent) };
}
