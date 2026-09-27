export type ExamSectionState = {
  id: string | null;
  label: string;
  index: number | null;
  position: number | null;
  questionSet: string | null;
  endsAtMs: number | null;
};

export type AdvanceBlockCode =
  | "invalid_token"
  | "expired"
  | "session_already_active"
  | "not_in_progress"
  | "question_not_assigned"
  | "invalid_session_id";

export type AdvanceInterpretation =
  | { type: "submitted" }
  | {
      type: "section";
      section: ExamSectionState;
      questions: unknown[] | undefined;
    }
  | { type: "blocked"; code: AdvanceBlockCode }
  | { type: "resync" }
  | { type: "soft"; message: string };

export const SECTION_LOCKED_MESSAGE =
  "This section is already finished, so that answer was not saved.";

const ADVANCE_FAILED_MESSAGE =
  "The section could not be finished. Check your connection and try again.";

export function finishSectionButtonLabel(label: string) {
  return `Finish ${label}`;
}

export function finishSectionConfirmCopy(label: string) {
  return `Confirm finishing ${label}? You may not come back to review your answers in ${label}.`;
}

export function sectionKey(section: ExamSectionState) {
  if (section.index !== null) return `index:${section.index}`;
  if (section.id) return section.id;
  if (section.position !== null) return `position:${section.position}`;
  return `label:${section.label}`;
}

export function sectionFromIndex(section: ExamSectionState | null): number | null {
  if (!section) return null;
  if (section.index !== null) return section.index;
  return section.position;
}

export function countdownEndsAtMs(
  section: ExamSectionState | null,
  examExpiresAtMs: number | null,
): number | null {
  if (section) return section.endsAtMs;
  return examExpiresAtMs;
}

export function shouldAutoAdvance(
  section: ExamSectionState | null,
  remainingMs: number | null,
) {
  if (!section || remainingMs === null) return false;
  return !(remainingMs > 0);
}

export function shouldAutoSubmitExam(
  section: ExamSectionState | null,
  remainingMs: number | null,
) {
  if (section || remainingMs === null) return false;
  return !(remainingMs > 0);
}

export function questionsAfterAdvance<T extends { question_set: string }>(
  current: T[],
  incoming: T[] | undefined,
  section: ExamSectionState,
): T[] {
  if (incoming) return incoming;
  if (section.questionSet) {
    const filtered = current.filter(
      (question) => question.question_set === section.questionSet,
    );
    if (filtered.length > 0) return filtered;
  }
  return current;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function timeMs(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

export function readSection(raw: unknown): ExamSectionState | null {
  const record = asRecord(raw);
  if (!record) return null;
  const label = text(record.label);
  if (!label) return null;

  const durationMinutes =
    finiteNumber(record.duration_minutes) ?? finiteNumber(record.duration);
  const startedAt =
    timeMs(record.started_at) ?? timeMs(record.section_started_at);
  const explicitEnd = timeMs(record.ends_at) ?? timeMs(record.expires_at);
  const endsAtMs =
    explicitEnd ??
    (startedAt !== null &&
    durationMinutes !== null &&
    durationMinutes >= 0
      ? startedAt + durationMinutes * 60_000
      : null);
  const index = finiteNumber(record.index);
  const position = finiteNumber(record.position);
  const wholeIndex =
    index !== null && Number.isInteger(index) ? index : null;
  const wholePosition =
    position !== null && Number.isInteger(position) ? position : null;

  return {
    id: text(record.id),
    label,
    index: wholeIndex ?? wholePosition,
    position: wholePosition ?? wholeIndex,
    questionSet: text(record.question_set),
    endsAtMs,
  };
}

export function sectionFromPayload(payload: unknown): ExamSectionState | null {
  const record = asRecord(payload);
  if (!record || !("section" in record) || record.section == null) return null;
  return readSection(record.section);
}

function questionsField(
  record: Record<string, unknown>,
): unknown[] | undefined {
  if (!("questions" in record)) return undefined;
  return Array.isArray(record.questions) ? record.questions : [];
}

function parseOkObject(
  data: unknown,
): { ok: boolean; record: Record<string, unknown> } | null {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const record = asRecord(value);
  if (!record || (record.ok !== true && record.ok !== false)) return null;
  return { ok: record.ok === true, record };
}

function errorCodeFromBlob(blob: string): string | undefined {
  const match = blob.match(
    /invalid_token|expired|already_submitted|session_already_active|not_in_progress|question_not_assigned|invalid_session_id|section_locked|section_mismatch|not_sectioned/,
  );
  return match?.[0];
}

function codeFromFailure(
  record: Record<string, unknown> | null,
  rpcError: { message?: string; details?: string } | null,
): string | undefined {
  const direct = record ? text(record.error) : null;
  if (direct) return direct;
  return errorCodeFromBlob(
    `${rpcError?.message ?? ""} ${rpcError?.details ?? ""}`,
  );
}

function isBlockCode(code: string | undefined): code is AdvanceBlockCode {
  return (
    code === "invalid_token" ||
    code === "expired" ||
    code === "session_already_active" ||
    code === "not_in_progress" ||
    code === "question_not_assigned" ||
    code === "invalid_session_id"
  );
}

export function interpretAdvancePayload(
  data: unknown,
  rpcError: { message?: string; details?: string } | null,
): AdvanceInterpretation {
  const parsed = parseOkObject(data);

  if (rpcError || !parsed || !parsed.ok) {
    const code = codeFromFailure(parsed?.record ?? null, rpcError);
    if (code === "already_submitted") return { type: "submitted" };
    if (code === "section_locked") {
      return { type: "soft", message: SECTION_LOCKED_MESSAGE };
    }
    if (code === "section_mismatch" || code === "not_sectioned") {
      return { type: "resync" };
    }
    if (isBlockCode(code)) return { type: "blocked", code };
    return { type: "soft", message: ADVANCE_FAILED_MESSAGE };
  }

  if (parsed.record.is_last === true || parsed.record.status === "submitted") {
    return { type: "submitted" };
  }

  const section = readSection(parsed.record.section);
  if (section) {
    return {
      type: "section",
      section,
      questions: questionsField(parsed.record),
    };
  }

  return { type: "soft", message: ADVANCE_FAILED_MESSAGE };
}
