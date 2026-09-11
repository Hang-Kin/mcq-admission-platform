import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

// ── Types for the request body sent by qr-generator-client.tsx ──────────────
interface GenerateInstanceRequest {
  examId: string;
  studentIds: string[];
  questionSetNames: string[];
  questionCount: number;
}

interface CreatedInstance {
  studentId: string;
  token: string;
}

export async function POST(request: NextRequest) {
  // ── 1. Parse and validate the request body ─────────────────────────────
  let body: GenerateInstanceRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { examId, studentIds, questionSetNames, questionCount } = body;

  if (!examId || typeof examId !== "string") {
    return NextResponse.json({ error: "missing_exam_id" }, { status: 400 });
  }
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json({ error: "no_students_selected" }, { status: 400 });
  }
  if (!Array.isArray(questionSetNames) || questionSetNames.length === 0) {
    return NextResponse.json({ error: "no_question_sets_selected" }, { status: 400 });
  }
  if (!Number.isInteger(questionCount) || questionCount <= 0) {
    return NextResponse.json({ error: "invalid_question_count" }, { status: 400 });
  }

  // ── 2. Confirm there's a real logged-in user ────────────────────────────
  // RLS on test_instances already enforces is_staff() for the actual insert,
  // but we fail fast here with a clear error instead of letting a raw
  // Postgres permission error bubble up to the client.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // ── 3. Fetch the exam (need duration_minutes for expires_at) ────────────
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, duration_minutes")
    .eq("id", examId)
    .single();

  if (examError || !exam) {
    return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  }

  // ── 4. Fetch candidate questions from the selected question set(s) ──────
  const { data: candidateQuestions, error: questionsError } = await supabase
    .from("questions")
    .select("id")
    .in("question_set", questionSetNames);

  if (questionsError) {
    console.error("generate-instance: failed to fetch questions", questionsError);
    return NextResponse.json({ error: "question_fetch_failed" }, { status: 500 });
  }

  if (!candidateQuestions || candidateQuestions.length < questionCount) {
    return NextResponse.json(
      { error: "not_enough_questions_in_selected_sets" },
      { status: 400 }
    );
  }

  // ── 5. Randomly draw the question subset ONCE for the whole batch ───────
  // This is the "same subset for every student in one sitting" fairness
  // rule locked in during Week 1 planning — do not move this inside the
  // per-student loop below, or every student will get a different draw.
  const shuffled = [...candidateQuestions].sort(() => Math.random() - 0.5);
  const assignedQuestionIds = shuffled.slice(0, questionCount).map((q) => q.id);

  const expiresAt = new Date(
    Date.now() + exam.duration_minutes * 60 * 1000
  ).toISOString();

  const created: CreatedInstance[] = [];
  const skipped: string[] = [];

  // ── 6. Per student: check existing status, then create or skip ──────────
  for (const studentId of studentIds) {
    const { data: existing, error: existingError } = await supabase
      .from("test_instances")
      .select("id, status")
      .eq("student_id", studentId)
      .eq("exam_id", examId)
      .maybeSingle();

    if (existingError) {
      console.error(
        `generate-instance: failed to check existing instance for student ${studentId}`,
        existingError
      );
      skipped.push(studentId);
      continue;
    }

    // Already started or finished — never overwrite, per the QR
    // regeneration rule (pending = regenerate freely, in_progress/submitted
    // = blocked, requires manual admin override which is not built here).
    if (existing && existing.status !== "pending") {
      skipped.push(studentId);
      continue;
    }

    const token = crypto.randomUUID().replace(/-/g, "");

    const { error: upsertError } = await supabase
      .from("test_instances")
      .upsert(
        {
          student_id: studentId,
          exam_id: examId,
          assigned_question_ids: assignedQuestionIds,
          access_token: token,
          expires_at: expiresAt,
          status: "pending",
          session_id: null,
          started_at: null,
          submitted_at: null,
        },
        { onConflict: "student_id,exam_id" }
      );

    if (upsertError) {
      console.error(
        `generate-instance: failed to upsert instance for student ${studentId}`,
        upsertError
      );
      skipped.push(studentId);
      continue;
    }

    created.push({ studentId, token });
  }

  return NextResponse.json({ created, skipped });
}
