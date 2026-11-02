import type { createClient } from "@/lib/supabase/server";

import { isMissingMarking } from "./markSchema";

type Client = Awaited<ReturnType<typeof createClient>>;

export type MarkRpcResult =
  | { ok: true; confirmed: number; changed: number; preserved: number }
  | {
      ok: false;
      code: "waiting" | "not_staff" | "not_found" | "bad_verdict" | "mismatch" | "failed";
    };

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function readRpc(data: unknown): MarkRpcResult {
  const record = asRecord(data);
  if (!record || record.ok !== true) {
    const code = record && typeof record.error === "string" ? record.error : "failed";
    if (
      code === "not_staff" ||
      code === "not_found" ||
      code === "bad_verdict" ||
      code === "mismatch"
    ) {
      return { ok: false, code };
    }
    return { ok: false, code: "failed" };
  }
  return {
    ok: true,
    confirmed: numberField(record, "confirmed"),
    changed: numberField(record, "changed"),
    preserved: numberField(record, "preserved"),
  };
}

async function call(
  supabase: Client,
  fn: string,
  args: Record<string, unknown>,
): Promise<MarkRpcResult> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, code: isMissingMarking(error) ? "waiting" : "failed" };
  return readRpc(data);
}

export function rpcConfirm(supabase: Client, responseId: string) {
  return call(supabase, "teacher_confirm_response", { p_response_id: responseId });
}

export function rpcOverride(
  supabase: Client,
  responseId: string,
  isCorrect: boolean,
  note: string,
) {
  return call(supabase, "teacher_override_response", {
    p_response_id: responseId,
    p_is_correct: isCorrect,
    p_note: note,
  });
}

export function rpcConfirmAll(supabase: Client, instanceId: string) {
  return call(supabase, "teacher_confirm_all", { p_instance_id: instanceId });
}

export function rpcRegrade(
  supabase: Client,
  input: {
    questionId: string;
    oldAnswer: string | null;
    newAnswer: string | null;
    updates: Array<{ id: string; is_correct: boolean | null }>;
  },
) {
  return call(supabase, "apply_question_regrade", {
    p_question_id: input.questionId,
    p_old_answer: input.oldAnswer,
    p_new_answer: input.newAnswer,
    p_updates: input.updates,
  });
}
