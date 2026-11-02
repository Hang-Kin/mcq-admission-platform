"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { UUID_RE } from "../results/ids";
import { labels } from "../results/labels";
import { loadRegrade } from "../results/loadRegrade";
import {
  rpcConfirm,
  rpcConfirmAll,
  rpcOverride,
  rpcRegrade,
  type MarkRpcResult,
} from "../results/markRpc";
import { regradeUpdates } from "../results/regrade";
import { requireStaff } from "../results/staffGate";

export type ReviewActionState = { error?: string } | null;

function staffError(error: string): string {
  if (error === "Sign in required.") return labels.signIn;
  return labels.staffOnly;
}

function markError(result: MarkRpcResult): string | null {
  if (result.ok) return null;
  if (result.code === "waiting") return labels.markingWaiting;
  if (result.code === "not_staff") return labels.staffOnly;
  if (result.code === "not_found") return labels.responseMissing;
  if (result.code === "bad_verdict") return labels.chooseVerdict;
  if (result.code === "mismatch") return labels.regradeMismatch;
  return labels.couldNotSaveMark;
}

function revalidateReview(instanceId: string) {
  revalidatePath("/admin/review");
  if (instanceId && UUID_RE.test(instanceId)) revalidatePath(`/admin/review/${instanceId}`);
  revalidatePath("/admin/exams", "layout");
}

export async function confirmResponse(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const instanceId = String(formData.get("instance_id") ?? "").trim();
  if (!UUID_RE.test(id)) return { error: labels.missingResponse };

  const staff = await requireStaff();
  if (!staff.ok) return { error: staffError(staff.error) };

  const result = await rpcConfirm(staff.supabase, id);
  const error = markError(result);
  if (error) return { error };

  revalidateReview(instanceId);
  return null;
}

export async function overrideResponse(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const instanceId = String(formData.get("instance_id") ?? "").trim();
  const verdict = String(formData.get("verdict") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!UUID_RE.test(id)) return { error: labels.missingResponse };
  if (verdict !== "correct" && verdict !== "incorrect") return { error: labels.chooseVerdict };

  const staff = await requireStaff();
  if (!staff.ok) return { error: staffError(staff.error) };

  const result = await rpcOverride(staff.supabase, id, verdict === "correct", note);
  const error = markError(result);
  if (error) return { error };

  revalidateReview(instanceId);
  return null;
}

export async function confirmAllResponses(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const instanceId = String(formData.get("instance_id") ?? "").trim();
  if (!UUID_RE.test(instanceId)) return { error: labels.sittingMissing };

  const staff = await requireStaff();
  if (!staff.ok) return { error: staffError(staff.error) };

  const result = await rpcConfirmAll(staff.supabase, instanceId);
  const error = markError(result);
  if (error) return { error };

  revalidateReview(instanceId);
  return null;
}

export async function applyRegrade(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const questionId = String(formData.get("question_id") ?? "").trim();
  const beforeKnown = String(formData.get("before_known") ?? "") === "1";
  const beforeNull = String(formData.get("before_null") ?? "") === "1";
  const beforeRaw = String(formData.get("before") ?? "");
  if (!UUID_RE.test(questionId)) return { error: labels.questionNotFound };

  const staff = await requireStaff();
  if (!staff.ok) return { error: staffError(staff.error) };

  const loaded = await loadRegrade(staff.supabase, questionId);
  if (!loaded.ok) return { error: labels.couldNotLoadRegrade };
  if (!loaded.markingReady) return { error: labels.markingWaiting };
  if (loaded.preview.changes.length === 0) return { error: labels.nothingToRegrade };

  const oldAnswer = beforeNull ? null : beforeKnown ? beforeRaw : null;
  const result = await rpcRegrade(staff.supabase, {
    questionId,
    oldAnswer,
    newAnswer: loaded.question.correctAnswer,
    updates: regradeUpdates(loaded.preview),
  });
  const error = markError(result);
  if (error || !result.ok) return { error: error ?? labels.regradeFailed };

  const params = new URLSearchParams({
    done: "1",
    changed: String(result.changed),
    kept: String(result.preserved),
  });
  if (beforeNull) params.set("before_null", "1");
  else if (beforeKnown) params.set("before", beforeRaw);
  revalidatePath(`/admin/review/regrade/${questionId}`);
  revalidatePath("/admin/review");
  revalidatePath("/admin/exams", "layout");
  redirect(`/admin/review/regrade/${questionId}?${params.toString()}`);
}

export async function reviewResponse(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const verdict = String(formData.get("verdict") ?? "").trim();

  if (!id) return { error: labels.missingResponseId };
  if (verdict !== "correct" && verdict !== "incorrect") return { error: labels.chooseVerdict };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: labels.signIn };

  if (UUID_RE.test(id)) {
    const result = await rpcOverride(supabase, id, verdict === "correct", "");
    if (result.ok) {
      revalidatePath("/admin/review", "layout");
      return null;
    }
    if (result.code !== "waiting") {
      return { error: markError(result) ?? labels.couldNotSaveReview };
    }
  }

  const { data, error } = await supabase
    .from("responses")
    .update({
      is_correct: verdict === "correct",
      graded_by: "manual",
      needs_review: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", id)
    .eq("needs_review", true)
    .select("id");

  if (error) return { error: labels.couldNotSaveReview };
  if (!data || data.length === 0) return { error: labels.notWaiting };

  revalidatePath("/admin/review");
  return null;
}
