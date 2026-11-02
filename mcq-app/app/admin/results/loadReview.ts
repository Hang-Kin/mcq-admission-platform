import { isMissingSubjectColumn, readQuestionSubject } from "@/components/mathText";
import { isMissingSchema } from "@/app/admin/students/schemaError";
import type { createClient } from "@/lib/supabase/server";

import { assembleReview, type ReviewQuestion, type ReviewQuestionInput, type ReviewResponseInput } from "./marking";

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
  examName: string;
  studentName: string;
  chineseName: string;
  submissionCode: string;
  status: string;
  questions: ReviewQuestion[];
};

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

  const withSubject = await supabase
    .from("responses")
    .select(
      `
      question_id,
      student_answer,
      is_correct,
      needs_review,
      questions!inner ( id, question_text, category, subject, correct_answer )
    `,
    )
    .eq("test_instance_id", instanceId);
  const responseQuery =
    withSubject.error && isMissingSubjectColumn(withSubject.error.message)
      ? await supabase
          .from("responses")
          .select(
            `
      question_id,
      student_answer,
      is_correct,
      needs_review,
      questions!inner ( id, question_text, category, correct_answer )
    `,
          )
          .eq("test_instance_id", instanceId)
      : withSubject;
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

  for (const row of (responseQuery.data ?? []) as Array<Record<string, unknown>>) {
    const question = asSingle(
      row.questions as Record<string, unknown> | Record<string, unknown>[] | null,
    );
    addQuestion(question);
    const questionId = text(row.question_id) || text(question?.id);
    if (!questionId) continue;
    responses.push({
      questionId,
      studentAnswer: textOrNull(row.student_answer),
      isCorrect: boolOrNull(row.is_correct),
      needsReview: row.needs_review === true,
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

  return {
    ok: true,
    sitting: {
      instanceId: text(instance.id),
      examId: text(instance.exam_id),
      examName: text(exam?.name) || "Exam",
      studentName: text(student?.name),
      chineseName,
      submissionCode: text(student?.application_number),
      status: text(instance.status),
      questions: assembleReview(instance.assigned_question_ids, questions, responses),
    },
  };
}
