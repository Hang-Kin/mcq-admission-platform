export type TimeslotWindow = {
  id: string;
  label: string;
  starts_at: string;
  ends_at: string;
};

export type TimeslotFields = {
  label: string;
  questionSet: string;
  startsAt: string;
  endsAt: string;
};

export type TimeslotValidationResult =
  | {
      ok: true;
      payload: {
        label: string;
        question_set: string;
        starts_at: string;
        ends_at: string;
      };
    }
  | { ok: false; error: string };

export function parseTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : ms;
}

export function validateTimeslotFields(
  input: TimeslotFields,
): TimeslotValidationResult {
  const label = input.label.trim();
  const question_set = input.questionSet.trim();
  const startsAt = input.startsAt.trim();
  const endsAt = input.endsAt.trim();

  if (!label || !question_set || !startsAt || !endsAt) {
    return { ok: false, error: "Please fill in all required fields." };
  }

  const startsMs = parseTimestamp(startsAt);
  const endsMs = parseTimestamp(endsAt);

  if (startsMs === null || endsMs === null) {
    return { ok: false, error: "Start and end must be valid dates." };
  }

  if (!(endsMs > startsMs)) {
    return { ok: false, error: "End time must be after start time." };
  }

  return {
    ok: true,
    payload: {
      label,
      question_set,
      starts_at: new Date(startsMs).toISOString(),
      ends_at: new Date(endsMs).toISOString(),
    },
  };
}

export function windowsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aS = parseTimestamp(aStart);
  const aE = parseTimestamp(aEnd);
  const bS = parseTimestamp(bStart);
  const bE = parseTimestamp(bEnd);
  if (aS === null || aE === null || bS === null || bE === null) return false;
  return aS < bE && aE > bS;
}

export function overlappingTimeslotLabels(
  candidate: { startsAt: string; endsAt: string },
  existing: TimeslotWindow[],
  ignoreId?: string,
): string[] {
  return existing
    .filter((slot) => slot.id !== ignoreId)
    .filter((slot) =>
      windowsOverlap(
        candidate.startsAt,
        candidate.endsAt,
        slot.starts_at,
        slot.ends_at,
      ),
    )
    .map((slot) => slot.label);
}

export function automaticTimeslotId(
  slots: TimeslotWindow[],
  nowMs: number = Date.now(),
): string | null {
  const unfinished = slots
    .filter((slot) => {
      const ends = parseTimestamp(slot.ends_at);
      return ends !== null && ends > nowMs;
    })
    .sort((a, b) => {
      const aStart = parseTimestamp(a.starts_at) ?? 0;
      const bStart = parseTimestamp(b.starts_at) ?? 0;
      return aStart - bStart;
    });

  if (unfinished[0]) return unfinished[0].id;

  const latest = [...slots].sort((a, b) => {
    const aStart = parseTimestamp(a.starts_at) ?? 0;
    const bStart = parseTimestamp(b.starts_at) ?? 0;
    return bStart - aStart;
  });

  return latest[0]?.id ?? null;
}

export function isUniqueLabelError(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "23505") return true;
  return /exam_id_label|duplicate key/i.test(error.message ?? "");
}
