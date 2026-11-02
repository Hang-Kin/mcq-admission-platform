import type { createClient } from "@/lib/supabase/server";

import { isMissingMarking } from "./markSchema";
import { teacherMarkFromEmbed } from "./marking";
import { previewRegrade, type RegradePreview, type RegradeSource } from "./regrade";

type Client = Awaited<ReturnType<typeof createClient>>;

export type RegradeQuestion = {
  id: string;
  text: string;
  type: string;
  correctAnswer: string | null;
};

export type RegradeLoad =
  | {
      ok: true;
      markingReady: boolean;
      question: RegradeQuestion;
      rows: RegradeSource[];
      preview: RegradePreview;
    }
  | { ok: false; error: string };

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

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function studentLabel(name: string, code: string): string {
  const trimmed = name.trim();
  if (trimmed && code) return `${trimmed} (${code})`;
  return trimmed || code || "Student";
}

const MARKS =
  "response_marks ( state, system_is_correct, system_mark_known, override_is_correct )";

function responseSelect(withMarks: boolean): string {
  return `
      id,
      student_answer,
      is_correct,
      test_instances!inner (
        student_id,
        students!inner ( name, application_number )
      )${withMarks ? `,\n      ${MARKS}` : ""}
    `;
}

export async function loadRegrade(
  supabase: Client,
  questionId: string,
): Promise<RegradeLoad> {
  const questionQuery = await supabase
    .from("questions")
    .select("id, question_text, type, correct_answer")
    .eq("id", questionId)
    .maybeSingle();

  if (questionQuery.error) return { ok: false, error: "Could not load this question." };
  if (!questionQuery.data) return { ok: false, error: "Question not found." };

  const questionRow = questionQuery.data as Record<string, unknown>;
  let markingReady = true;
  let responseQuery = await supabase
    .from("responses")
    .select(responseSelect(true))
    .eq("question_id", questionId);

  if (responseQuery.error && isMissingMarking(responseQuery.error)) {
    markingReady = false;
    responseQuery = await supabase
      .from("responses")
      .select(responseSelect(false))
      .eq("question_id", questionId);
  }
  if (responseQuery.error) return { ok: false, error: "Could not load answers for this question." };

  const rows: RegradeSource[] = [];
  for (const row of (responseQuery.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const instance = asSingle(row.test_instances as Record<string, unknown> | Record<string, unknown>[] | null);
    const student = asSingle(
      instance?.students as Record<string, unknown> | Record<string, unknown>[] | null,
    );
    const mark = teacherMarkFromEmbed(row.response_marks);
    const responseId = text(row.id);
    if (!responseId) continue;
    rows.push({
      responseId,
      studentId: text(instance?.student_id),
      studentLabel: studentLabel(text(student?.name), text(student?.application_number)),
      studentAnswer: textOrNull(row.student_answer),
      systemIsCorrect: boolOrNull(row.is_correct),
      overridden: mark.state === "overridden",
    });
  }

  rows.sort((a, b) => a.studentLabel.localeCompare(b.studentLabel) || a.responseId.localeCompare(b.responseId));

  const question: RegradeQuestion = {
    id: text(questionRow.id),
    text: text(questionRow.question_text) || "Question",
    type: text(questionRow.type),
    correctAnswer: textOrNull(questionRow.correct_answer),
  };

  return {
    ok: true,
    markingReady,
    question,
    rows,
    preview: previewRegrade({
      type: question.type,
      correctAnswer: question.correctAnswer,
      rows,
    }),
  };
}
