import { isMissingSubjectColumn, readQuestionSubject } from "@/components/mathText";
import { isMissingSchema } from "@/app/admin/students/schemaError";
import type { createClient } from "@/lib/supabase/server";

import { isMissingMarking } from "./markSchema";
import {
  assembleReview,
  teacherMarkFromEmbed,
  type ReviewQuestion,
  type ReviewQuestionInput,
  type ReviewResponseInput,
} from "./marking";

type Client = Awaited<ReturnType<typeof createClient>>;

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function boolOrNull(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

export type ReviewSitting = {
  instanceId: string;
  examId: string;
  studentId: string;
  examName: string;
  studentName: string;
  chineseName: string;
  submissionCode: string;
  status: string;
  assignedCount: number | undefined;
  markingReady: boolean;
  finalizedPercent: number | null;
  finalizedAt: string | null;
  questions: ReviewQuestion[];
};

const MARKS =
  "response_marks ( state, system_is_correct, system_mark_known, override_is_correct, note, marked_by_label, marked_at )";

function responseSelect(withSubject: boolean, withMarks: boolean): string {
  const question = withSubject
    ? "questions!inner ( id, question_text, category, subject, correct_answer )"
    : "questions!inner ( id, question_text, category, correct_answer )";
  const marks = withMarks ? `,\n      ${MARKS}` : "";
  return `
      id,
      question_id,
      student_answer,
      is_correct,
      needs_review${marks},
      ${question}
    `;
}

export async function loadReviewSitting(
  supabase: Client,
  instanceId: string,
): Promise<{ ok: true; sitting: ReviewSitting } | { ok: false; error: string }> {
  const loaded = await supabase
    .from("test_instances")
    .select(
      `
      id,
      exam_id,
      student_id,
      status,
      assigned_question_ids,
      students!inner ( name, application_number ),
      exams!inner ( name )
    `,
    )
    .eq("id", instanceId)
    .maybeSingle();

  if (loaded.error || !loaded.data) return { ok: false, error: "This sitting was not found." };

  const instance = loaded.data as Record<string, unknown>;
  const student = asSingle(instance.students as Record<string, unknown> | Record<string, unknown>[] | null);
  const exam = asSingle(instance.exams as Record<string, unknown> | Record<string, unknown>[] | null);
  const studentId = text(instance.student_id);

  let chineseName = "";
  if (studentId) {
    const extra = await supabase
      .from("students")
      .select("chinese_name")
      .eq("id", studentId)
      .maybeSingle();
    if (!extra.error && extra.data) {
      chineseName = text((extra.data as Record<string, unknown>).chinese_name);
    } else if (extra.error && !isMissingSchema(extra.error)) {
      return { ok: false, error: "Could not load this student." };
    }
  }

  const loadResponses = async (withMarks: boolean) => {
    const withSubject = await supabase
      .from("responses")
      .select(responseSelect(true, withMarks))
      .eq("test_instance_id", instanceId);
    if (withSubject.error && isMissingSubjectColumn(withSubject.error.message)) {
      return supabase
        .from("responses")
        .select(responseSelect(false, withMarks))
        .eq("test_instance_id", instanceId);
    }
    return withSubject;
  };

  let markingReady = true;
  let responseQuery = await loadResponses(true);
  if (responseQuery.error && isMissingMarking(responseQuery.error)) {
    markingReady = false;
    responseQuery = await loadResponses(false);
  }
  if (responseQuery.error) return { ok: false, error: "Could not load answers." };

  const questions: ReviewQuestionInput[] = [];
  const responses: ReviewResponseInput[] = [];
  const seenQuestions = new Set<string>();

  const addQuestion = (row: Record<string, unknown> | null) => {
    if (!row) return;
    const id = text(row.id);
    if (!id || seenQuestions.has(id)) return;
    seenQuestions.add(id);
    questions.push({
      id,
      questionText: text(row.question_text) || "Unknown question",
      category: text(row.category),
      subject: readQuestionSubject(row),
      correctAnswer: textOrNull(row.correct_answer),
    });
  };

  for (const row of (responseQuery.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const question = asSingle(
      row.questions as Record<string, unknown> | Record<string, unknown>[] | null,
    );
    addQuestion(question);
    const questionId = text(row.question_id) || text(question?.id);
    if (!questionId) continue;
    responses.push({
      questionId,
      responseId: text(row.id) || null,
      studentAnswer: textOrNull(row.student_answer),
      isCorrect: boolOrNull(row.is_correct),
      needsReview: row.needs_review === true,
      mark: markingReady ? teacherMarkFromEmbed(row.response_marks) : undefined,
    });
  }

  const assigned = Array.isArray(instance.assigned_question_ids)
    ? instance.assigned_question_ids.filter((id): id is string => typeof id === "string")
    : [];
  const missing = assigned.filter((id) => !seenQuestions.has(id));
  if (missing.length > 0) {
    const withSubjectQuestions = await supabase
      .from("questions")
      .select("id, question_text, category, subject, correct_answer")
      .in("id", missing);
    const questionQuery =
      withSubjectQuestions.error && isMissingSubjectColumn(withSubjectQuestions.error.message)
        ? await supabase
            .from("questions")
            .select("id, question_text, category, correct_answer")
            .in("id", missing)
        : withSubjectQuestions;
    if (questionQuery.error) return { ok: false, error: "Could not load questions." };
    for (const row of (questionQuery.data ?? []) as Array<Record<string, unknown>>) {
      addQuestion(row);
    }
  }

  let finalizedPercent: number | null = null;
  let finalizedAt: string | null = null;
  const examId = text(instance.exam_id);
  if (studentId && examId) {
    const grade = await supabase
      .from("grades")
      .select("final_grade, finalized_at")
      .eq("student_id", studentId)
      .eq("exam_id", examId)
      .order("finalized_at", { ascending: false })
      .limit(1);
    const gradeRow = (grade.data ?? [])[0] as Record<string, unknown> | undefined;
    if (!grade.error && gradeRow && gradeRow.final_grade != null && gradeRow.final_grade !== "") {
      const percent = Number(gradeRow.final_grade);
      if (Number.isFinite(percent)) finalizedPercent = percent;
      finalizedAt = textOrNull(gradeRow.finalized_at);
    }
  }

  const assignedCount = Array.isArray(instance.assigned_question_ids)
    ? instance.assigned_question_ids.length
    : undefined;

  return {
    ok: true,
    sitting: {
      instanceId: text(instance.id),
      examId,
      studentId,
      examName: text(exam?.name) || "Exam",
      studentName: text(student?.name),
      chineseName,
      submissionCode: text(student?.application_number),
      status: text(instance.status),
      assignedCount,
      markingReady,
      finalizedPercent,
      finalizedAt,
      questions: assembleReview(instance.assigned_question_ids, questions, responses),
    },
  };
}
