export const SUBJECTS = ["Math", "Chinese"] as const;

export type SubjectId = (typeof SUBJECTS)[number];

export const DEFAULT_QUESTIONS_PER_TOPIC = 2;

export const DEFAULT_MINUTES: Record<SubjectId, number> = {
  Math: 7,
  Chinese: 8,
};

export function isRealTopic(category: string | null | undefined): boolean {
  const value = category?.trim() ?? "";
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower !== "math" && lower !== "chinese";
}

export function countRealTopics(categories: Array<string | null | undefined>): number {
  const names = new Set<string>();
  for (const category of categories) {
    if (!isRealTopic(category)) continue;
    names.add(category!.trim());
  }
  return names.size;
}

export function questionTotal(topicCount: number, perTopic: number): string {
  const topics = topicCount === 1 ? "1 topic" : `${topicCount} topics`;
  const questions = topicCount * perTopic;
  const questionLabel = questions === 1 ? "1 question" : `${questions} questions`;
  return `${topics} x ${perTopic} = ${questionLabel}`;
}

export function parsePositiveInteger(
  value: string,
  label: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const text = value.trim();
  if (!/^[1-9][0-9]*$/.test(text)) {
    return { ok: false, error: `${label} must be a whole number greater than 0.` };
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number)) {
    return { ok: false, error: `${label} is too large.` };
  }
  return { ok: true, value: number };
}

export function isMissingSchema(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

export function settingsWriteError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("schema cache") ||
    lower.includes("does not exist") ||
    lower.includes("subject_settings")
  ) {
    return "Subject settings are waiting for a database update. Nothing was saved.";
  }
  if (lower.includes("row-level") || lower.includes("permission") || lower.includes("policy")) {
    return "You do not have permission to change these settings.";
  }
  if (lower.includes("check") || lower.includes("integer")) {
    return "Use whole numbers greater than 0.";
  }
  return "Could not save these settings.";
}
