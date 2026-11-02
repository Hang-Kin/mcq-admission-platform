import { parseHongKongDateTime } from "../../../lib/hongKongTime";

import { DEFAULT_MINUTES, type SubjectId } from "./subjectSettings";

export const MINUTES_LOCKED_MESSAGE =
  "A student has already started, so these minutes stay fixed.";

export type SubjectMinutes = Record<SubjectId, number>;

export type SectionMinuteRow = {
  subject: string | null;
  position: number;
  durationMinutes: number;
};

export function subjectMinutesFromRows(
  rows: Array<{ subject: string | null; durationMinutes: number | null }>,
): SubjectMinutes {
  const minutes: SubjectMinutes = { ...DEFAULT_MINUTES };
  for (const row of rows) {
    if (row.subject !== "Math" && row.subject !== "Chinese") continue;
    if (!Number.isInteger(row.durationMinutes) || (row.durationMinutes ?? 0) < 1) continue;
    minutes[row.subject] = row.durationMinutes as number;
  }
  return minutes;
}

export function snapshotMinutesByPosition(plan: unknown): Map<number, number> {
  const minutes = new Map<number, number>();
  if (!Array.isArray(plan)) return minutes;
  for (const item of plan) {
    if (!item || typeof item !== "object") continue;
    const record = item as { position?: unknown; duration_minutes?: unknown };
    const position = Number(record.position);
    const duration = Number(record.duration_minutes);
    if (!Number.isInteger(position) || position < 0) continue;
    if (!Number.isInteger(duration) || duration < 1) continue;
    if (!minutes.has(position)) minutes.set(position, duration);
  }
  return minutes;
}

export function earliestSectionPlan(
  rows: Array<{ startedAt: string | null; plan: unknown }>,
): unknown {
  const sorted = rows
    .filter((row) => row.startedAt != null && !Number.isNaN(Date.parse(row.startedAt)))
    .sort((a, b) => Date.parse(a.startedAt ?? "") - Date.parse(b.startedAt ?? ""));
  return sorted[0]?.plan ?? null;
}

export function effectiveSectionMinutes(input: {
  subject: string | null;
  storedMinutes: number;
  snapshotMinutes: number | null;
  settings: SubjectMinutes | null;
  started: boolean;
}): number {
  if (input.started) {
    if (input.snapshotMinutes != null && input.snapshotMinutes > 0) return input.snapshotMinutes;
    return input.storedMinutes;
  }
  if (
    (input.subject === "Math" || input.subject === "Chinese") &&
    input.settings &&
    Number.isInteger(input.settings[input.subject]) &&
    input.settings[input.subject] > 0
  ) {
    return input.settings[input.subject];
  }
  return input.storedMinutes;
}

export function totalExamMinutes(input: {
  sections: SectionMinuteRow[];
  settings: SubjectMinutes | null;
  started: boolean;
  plan: unknown;
}): number {
  const snapshots = input.started ? snapshotMinutesByPosition(input.plan) : new Map<number, number>();
  return input.sections.reduce((total, section) => {
    return (
      total +
      effectiveSectionMinutes({
        subject: section.subject,
        storedMinutes: section.durationMinutes,
        snapshotMinutes: snapshots.get(section.position) ?? null,
        settings: input.settings,
        started: input.started,
      })
    );
  }, 0);
}

export type ExamSectionMinute = SectionMinuteRow & { examId: string };

export function examMinuteTotals(input: {
  sections: ExamSectionMinute[];
  startedExamIds: Iterable<string>;
  plans: Array<{ examId: string; startedAt: string | null; plan: unknown }>;
  settings: SubjectMinutes | null;
}): Map<string, number> {
  const started = new Set(input.startedExamIds);
  const plansByExam = new Map<string, Array<{ startedAt: string | null; plan: unknown }>>();
  for (const row of input.plans) {
    const list = plansByExam.get(row.examId) ?? [];
    list.push({ startedAt: row.startedAt, plan: row.plan });
    plansByExam.set(row.examId, list);
  }
  const sectionsByExam = new Map<string, SectionMinuteRow[]>();
  for (const section of input.sections) {
    const list = sectionsByExam.get(section.examId) ?? [];
    list.push(section);
    sectionsByExam.set(section.examId, list);
  }
  const totals = new Map<string, number>();
  for (const [examId, sections] of sectionsByExam) {
    const isStarted = started.has(examId);
    totals.set(
      examId,
      totalExamMinutes({
        sections,
        settings: input.settings,
        started: isStarted,
        plan: isStarted ? earliestSectionPlan(plansByExam.get(examId) ?? []) : null,
      }),
    );
  }
  return totals;
}

export function sectionDurationView(input: {
  subject: string | null;
  position: number;
  storedMinutes: number;
  settings: SubjectMinutes | null;
  started: boolean;
  plan: unknown;
}): { minutes: number; locked: boolean; note: string | null } {
  const minutes = effectiveSectionMinutes({
    subject: input.subject,
    storedMinutes: input.storedMinutes,
    snapshotMinutes: input.started
      ? (snapshotMinutesByPosition(input.plan).get(input.position) ?? null)
      : null,
    settings: input.settings,
    started: input.started,
  });
  if (input.started) {
    return { minutes, locked: true, note: "Fixed when a student started." };
  }
  if ((input.subject === "Math" || input.subject === "Chinese") && input.settings) {
    return { minutes, locked: true, note: "From Subject settings." };
  }
  return { minutes, locked: false, note: null };
}

export function resolveSavedDuration(input: {
  started: boolean;
  subject: string | null;
  storedMinutes: number;
  submittedMinutes: number;
  effectiveMinutes?: number | null;
  settings: SubjectMinutes | null;
}): { ok: true; minutes: number } | { ok: false; error: string } {
  if (input.started) {
    const showingFixed =
      input.effectiveMinutes != null && input.submittedMinutes === input.effectiveMinutes;
    if (input.submittedMinutes !== input.storedMinutes && !showingFixed) {
      return { ok: false, error: MINUTES_LOCKED_MESSAGE };
    }
    return { ok: true, minutes: input.storedMinutes };
  }
  if (
    (input.subject === "Math" || input.subject === "Chinese") &&
    input.settings &&
    input.settings[input.subject] > 0
  ) {
    return { ok: true, minutes: input.settings[input.subject] };
  }
  return { ok: true, minutes: input.submittedMinutes };
}

export function sectionMinuteUpdates(input: {
  sections: Array<{
    id: string;
    examId: string;
    subject: string | null;
    durationMinutes: number;
  }>;
  startedExamIds: Iterable<string>;
  settings: SubjectMinutes;
}): Array<{ id: string; examId: string; durationMinutes: number }> {
  const started = new Set(input.startedExamIds);
  const updates: Array<{ id: string; examId: string; durationMinutes: number }> = [];
  for (const section of input.sections) {
    if (started.has(section.examId)) continue;
    if (section.subject !== "Math" && section.subject !== "Chinese") continue;
    const next = input.settings[section.subject];
    if (!Number.isInteger(next) || next < 1) continue;
    if (next !== section.durationMinutes) {
      updates.push({ id: section.id, examId: section.examId, durationMinutes: next });
    }
  }
  return updates;
}

export function slotLengthError(
  startMs: number,
  endMs: number,
  examMinutes: number,
): string | null {
  if (!Number.isInteger(examMinutes) || examMinutes <= 0) return null;
  if (endMs - startMs >= examMinutes * 60_000) return null;
  const slotMinutes = Math.max(0, Math.floor((endMs - startMs) / 60_000));
  const slotLabel = slotMinutes === 1 ? "1 minute" : `${slotMinutes} minutes`;
  return `This slot is ${slotLabel} but the exam needs ${examMinutes}.`;
}

export function shortSlotWarning(
  startsAt: string | null,
  endsAt: string | null,
  examMinutes: number,
): string | null {
  if (!startsAt || !endsAt) return null;
  const startMs = parseHongKongDateTime(startsAt);
  const endMs = parseHongKongDateTime(endsAt);
  if (startMs == null || endMs == null || endMs <= startMs) return null;
  return slotLengthError(startMs, endMs, examMinutes);
}

export function examNeedsLabel(minutes: number): string | null {
  if (!Number.isInteger(minutes) || minutes <= 0) return null;
  if (minutes === 1) return "This exam needs 1 minute.";
  return `This exam needs ${minutes} minutes.`;
}
