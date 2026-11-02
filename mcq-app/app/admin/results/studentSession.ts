// Keys returned by exam_section_questions (migration 020). correct_answer is not one of them.
export const STUDENT_SESSION_QUESTION_KEYS = [
  "id",
  "question_text",
  "type",
  "options",
  "category",
  "subject",
  "question_set",
  "image_url",
] as const;

export function studentSessionQuestion(row: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const key of STUDENT_SESSION_QUESTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) safe[key] = row[key];
  }
  return safe;
}

export function studentSessionPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.questions)) return payload;
  return {
    ...record,
    questions: record.questions.map((question) => {
      if (!question || typeof question !== "object" || Array.isArray(question)) return question;
      return studentSessionQuestion(question as Record<string, unknown>);
    }),
  };
}

export function questionKeysFromExamSectionQuestions(sql: string): string[] {
  const start = sql.search(/create or replace function public\.exam_section_questions/i);
  if (start < 0) return [];
  const end = sql.indexOf("$$;", start);
  const body = end < 0 ? sql.slice(start) : sql.slice(start, end);
  return [...body.matchAll(/'([a-z0-9_]+)',\s*q\./g)].map((match) => match[1] ?? "");
}

// True when the migration keeps correct_answer off the anonymous grant
// and leaves signed-in staff able to read the table.
export function anonCannotSelectCorrectAnswer(sql: string): boolean {
  const text = sql.toLowerCase();
  return (
    text.includes("revoke select on table public.questions from anon") &&
    text.includes("revoke select on table public.questions from public") &&
    text.includes("column_name <> 'correct_answer'") &&
    text.includes("grant select (%s) on table public.questions to anon") &&
    text.includes("grant select on table public.questions to authenticated") &&
    !text.includes("revoke select on table public.questions from authenticated") &&
    !text.includes("grant select (correct_answer")
  );
}
