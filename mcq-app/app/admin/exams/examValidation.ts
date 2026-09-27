export type ExamFields = {
  name: string;
  durationMinutes: string;
};

export type ExamValidationResult =
  | {
      ok: true;
      payload: {
        name: string;
        duration_minutes: number;
      };
    }
  | { ok: false; error: string };

// exams.duration_minutes is a Postgres integer.
const MAX_DURATION_MINUTES = 2147483647;

export function validateExamFields(input: ExamFields): ExamValidationResult {
  const name = input.name.trim();
  const durationRaw = input.durationMinutes.trim();

  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  if (!durationRaw) {
    return { ok: false, error: "Duration is required." };
  }

  if (!/^\d+$/.test(durationRaw)) {
    return {
      ok: false,
      error: "Duration must be a whole number of minutes, at least 1.",
    };
  }

  const duration_minutes = Number(durationRaw);
  if (
    !Number.isSafeInteger(duration_minutes) ||
    duration_minutes < 1 ||
    duration_minutes > MAX_DURATION_MINUTES
  ) {
    return {
      ok: false,
      error: "Duration must be a whole number of minutes, at least 1.",
    };
  }

  return {
    ok: true,
    payload: { name, duration_minutes },
  };
}
