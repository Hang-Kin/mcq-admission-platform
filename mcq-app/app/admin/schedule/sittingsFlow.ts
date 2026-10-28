export type SittingState = "Not prepared" | "Prepared" | "Locked";

export type SittingsFocus =
  | "waiting"
  | "create"
  | "subjects"
  | "time"
  | "prepare"
  | "students"
  | "codes"
  | "print";

export function validateSittingTime(input: {
  label: string;
  startsAt: string;
  endsAt: string;
}):
  | { ok: true; label: string; startsAt: string; endsAt: string }
  | { ok: false; error: string } {
  const label = input.label.trim();
  const startsAt = input.startsAt.trim();
  const endsAt = input.endsAt.trim();
  if (!label) return { ok: false, error: "Enter a name for this time." };
  if (!startsAt || !endsAt) return { ok: false, error: "Enter a start and an end." };

  const startsMs = Date.parse(startsAt);
  const endsMs = Date.parse(endsAt);
  if (Number.isNaN(startsMs) || Number.isNaN(endsMs)) {
    return { ok: false, error: "Start and end must be valid dates." };
  }
  if (!(endsMs > startsMs)) {
    return { ok: false, error: "End time must be after start time." };
  }

  return {
    ok: true,
    label,
    startsAt: new Date(startsMs).toISOString(),
    endsAt: new Date(endsMs).toISOString(),
  };
}

export function prepareTargetId(
  sittings: Array<{ id: string; startsAt: string | null; status: SittingState }>,
  nowMs: number,
  inNextDay: (startsAt: string | null, nowMs: number) => boolean,
): string | null {
  const sorted = [...sittings].sort((a, b) => startMs(a.startsAt) - startMs(b.startsAt));
  const soon = sorted.find(
    (sitting) => sitting.status === "Not prepared" && inNextDay(sitting.startsAt, nowMs),
  );
  if (soon) return soon.id;
  const later = sorted.find(
    (sitting) =>
      sitting.status === "Not prepared" &&
      sitting.startsAt != null &&
      !Number.isNaN(Date.parse(sitting.startsAt)) &&
      Date.parse(sitting.startsAt) > nowMs,
  );
  return later?.id ?? null;
}

function startMs(startsAt: string | null): number {
  if (!startsAt) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(startsAt);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

export function sittingsFocus(input: {
  schemaReady: boolean;
  examCount: number;
  selectedHasSubjects: boolean;
  prepareHere: boolean;
  selectedTimeCount: number;
  studentCount: number;
  codedStudentCount: number;
}): SittingsFocus {
  if (!input.schemaReady) return "waiting";
  if (input.examCount === 0) return "create";
  if (!input.selectedHasSubjects) return "subjects";
  if (input.prepareHere) return "prepare";
  if (input.selectedTimeCount === 0) return "time";
  if (input.studentCount === 0) return "students";
  if (input.codedStudentCount < input.studentCount) return "codes";
  return "print";
}

export function hasMathAndChinese(subjects: Array<string | null>): boolean {
  const names = new Set(subjects.filter((subject): subject is string => Boolean(subject)));
  return names.has("Math") && names.has("Chinese");
}
