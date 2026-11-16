export function sessionIdStorageKey(token: string): string {
  return `mcq-session:${token}`;
}

export function questionIndexStorageKey(token: string): string {
  return `mcq-question:${token}`;
}

/** Keys this screen writes. The server end time is not one of them. */
export function resumeStorageKeys(token: string): readonly string[] {
  return [sessionIdStorageKey(token), questionIndexStorageKey(token)];
}

function readItem(storage: Pick<Storage, "getItem">, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function readSessionId(
  storage: Pick<Storage, "getItem">,
  token: string,
): string | null {
  const raw = readItem(storage, sessionIdStorageKey(token));
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function writeSessionId(
  storage: Pick<Storage, "setItem">,
  token: string,
  sessionId: string,
): void {
  const trimmed = sessionId.trim();
  if (!trimmed) return;
  try {
    storage.setItem(sessionIdStorageKey(token), trimmed);
  } catch {
    // Storage can throw in private mode. The exam still runs in memory.
  }
}

export function clearResumeStorage(
  local: Pick<Storage, "removeItem">,
  session: Pick<Storage, "removeItem">,
  token: string,
): void {
  try {
    local.removeItem(sessionIdStorageKey(token));
  } catch {
    // ignore
  }
  try {
    session.removeItem(questionIndexStorageKey(token));
  } catch {
    // ignore
  }
}

export function startSessionArgs(storedSessionId: string | null): {
  p_session_id: string | null;
} {
  return { p_session_id: storedSessionId };
}

const inflightStarts = new Map<string, Promise<unknown>>();

/**
 * A remount can fire the opening call twice before the id is stored.
 * Share that in-flight call so the second one does not look like another device.
 */
export function startSessionOnce<T>(
  token: string,
  storedSessionId: string | null,
  call: () => PromiseLike<T>,
): Promise<T> {
  const key = `${token}\n${storedSessionId ?? ""}`;
  const existing = inflightStarts.get(key);
  if (existing) return existing as Promise<T>;
  const pending = Promise.resolve(call()).finally(() => {
    if (inflightStarts.get(key) === pending) inflightStarts.delete(key);
  });
  inflightStarts.set(key, pending);
  return pending;
}

export type ResumeClearReason = "submitted" | "expired" | "already_submitted";

export function resumeClearReason(input: {
  submitted?: boolean;
  error?: string | null;
  status?: string | null;
}): ResumeClearReason | null {
  if (input.submitted || input.status === "submitted") return "submitted";
  if (input.error === "already_submitted") return "already_submitted";
  if (input.error === "expired") return "expired";
  return null;
}

const SAVED_ANSWER_DENY = new Set(["correct_answer", "is_correct", "access_token"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Answers for this sitting, from start_session.saved_answers only.
 * Absent field means the live function has not been updated yet: return null
 * and leave the in-memory answers alone. Never copy correct_answer.
 */
export function savedAnswersFromPayload(payload: unknown): Record<string, string> | null {
  const record = asRecord(payload);
  if (!record || !Object.prototype.hasOwnProperty.call(record, "saved_answers")) {
    return null;
  }
  const map = asRecord(record.saved_answers);
  if (!map) return {};
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    if (SAVED_ANSWER_DENY.has(key)) continue;
    if (typeof value !== "string") continue;
    answers[key] = value;
  }
  return answers;
}

export function readQuestionPlace(
  storage: Pick<Storage, "getItem">,
  token: string,
  section: string | null,
): number | null {
  const raw = readItem(storage, questionIndexStorageKey(token));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { section?: unknown; index?: unknown };
    if (parsed.section !== section) return null;
    if (typeof parsed.index !== "number" || !Number.isInteger(parsed.index) || parsed.index < 0) {
      return null;
    }
    return parsed.index;
  } catch {
    return null;
  }
}

export function writeQuestionPlace(
  storage: Pick<Storage, "setItem">,
  token: string,
  section: string | null,
  index: number,
): void {
  if (!Number.isInteger(index) || index < 0) return;
  try {
    storage.setItem(
      questionIndexStorageKey(token),
      JSON.stringify({ section, index }),
    );
  } catch {
    // ignore
  }
}

export function clampQuestionIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index));
}

export function examLeaveGuardActive(state: {
  loading: boolean;
  blockingError: boolean;
  submitted: boolean;
  questionCount: number;
}): boolean {
  return !state.loading && !state.blockingError && !state.submitted && state.questionCount > 0;
}

export function restoredQuestionIndex(
  storage: Pick<Storage, "getItem">,
  token: string,
  section: string | null,
  total: number,
): number {
  const place = readQuestionPlace(storage, token, section);
  if (place === null) return 0;
  return clampQuestionIndex(place, total);
}
