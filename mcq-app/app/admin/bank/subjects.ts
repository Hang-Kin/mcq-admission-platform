export const SUBJECTS = [
  {
    id: "Math",
    title: "Math",
    description: "Numbers, fractions, decimals, and equations.",
  },
  {
    id: "Chinese",
    title: "Chinese",
    description: "成語, 修辭, 文言字詞, and words with close meanings.",
  },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]["id"];

export const DEFAULT_QUESTIONS_PER_TOPIC = 2;

export function parseSubject(value: unknown): SubjectId | null {
  const text = String(value ?? "");
  if (text === "Math" || text === "Chinese") return text;
  return null;
}

export function subjectById(id: SubjectId) {
  return SUBJECTS.find((subject) => subject.id === id) ?? SUBJECTS[0];
}

/** A real topic is a non-blank name that is not the old subject word. */
export function isRealTopic(category: string | null | undefined): boolean {
  const value = category?.trim() ?? "";
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower !== "math" && lower !== "chinese";
}

export function questionsPerTopic(value: unknown): number {
  const number = typeof value === "number" ? value : Number(String(value ?? ""));
  if (!Number.isInteger(number) || number < 1) return DEFAULT_QUESTIONS_PER_TOPIC;
  return number;
}

export function validateTopicName(
  value: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = value.trim();
  if (!name) return { ok: false, error: "Enter a topic name." };
  if (name.length > 80) return { ok: false, error: "Use a shorter topic name." };
  if (/[/?#\\]/.test(name)) {
    return { ok: false, error: "That topic name cannot be used." };
  }
  if (!isRealTopic(name) || name === "without-topic") {
    return { ok: false, error: "Use a topic name, such as Fractions or 成語." };
  }
  return { ok: true, name };
}

export function decodeTopicParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function topicHref(subject: SubjectId, topic: string): string {
  return `/admin/bank/${subject}/${encodeURIComponent(topic)}`;
}
