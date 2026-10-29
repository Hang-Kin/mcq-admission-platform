import type { SupabaseClient } from "@supabase/supabase-js";

export type QrCodeRow = {
  studentId: string;
  token: string;
};

export type QrCodeBatch = {
  created: QrCodeRow[];
  skippedStarted: number;
  skippedMissing: number;
  skippedFailed: number;
};

function emptyBatch(): QrCodeBatch {
  return { created: [], skippedStarted: 0, skippedMissing: 0, skippedFailed: 0 };
}

export async function createPendingQrCodes(
  supabase: SupabaseClient,
  input: {
    examId: string;
    studentIds: string[];
    assignedQuestionIds: string[];
    expiresAt: string;
  },
): Promise<QrCodeBatch> {
  const batch = emptyBatch();

  for (const studentId of input.studentIds) {
    const { data: existing, error: existingError } = await supabase
      .from("test_instances")
      .select("id, status")
      .eq("student_id", studentId)
      .eq("exam_id", input.examId)
      .maybeSingle();

    if (existingError) {
      batch.skippedFailed += 1;
      continue;
    }

    if (existing && existing.status !== "pending") {
      batch.skippedStarted += 1;
      continue;
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const { error: upsertError } = await supabase.from("test_instances").upsert(
      {
        student_id: studentId,
        exam_id: input.examId,
        assigned_question_ids: input.assignedQuestionIds,
        access_token: token,
        expires_at: input.expiresAt,
        status: "pending",
        session_id: null,
        started_at: null,
        submitted_at: null,
      },
      { onConflict: "student_id,exam_id" },
    );

    if (upsertError) {
      batch.skippedFailed += 1;
      continue;
    }

    batch.created.push({ studentId, token });
  }

  return batch;
}

export async function loadPendingQrCodes(
  supabase: SupabaseClient,
  examId: string,
  studentIds: string[],
): Promise<QrCodeBatch | { error: "could_not_load" }> {
  const { data, error } = await supabase
    .from("test_instances")
    .select("student_id, status, access_token")
    .eq("exam_id", examId)
    .in("student_id", studentIds);

  if (error) return { error: "could_not_load" };

  const byStudent = new Map<string, { status: string | null; token: string }>();
  for (const row of data ?? []) {
    if (typeof row.student_id !== "string") continue;
    byStudent.set(row.student_id, {
      status: typeof row.status === "string" ? row.status : null,
      token: typeof row.access_token === "string" ? row.access_token : "",
    });
  }

  const batch = emptyBatch();
  for (const studentId of studentIds) {
    const row = byStudent.get(studentId);
    if (row?.status === "pending" && row.token.length > 0) {
      batch.created.push({ studentId, token: row.token });
      continue;
    }
    if (row?.status && row.status !== "pending") batch.skippedStarted += 1;
    else batch.skippedMissing += 1;
  }
  return batch;
}
