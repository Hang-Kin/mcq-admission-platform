import { hongKongParts, parseHongKongDateTime } from "../../../lib/hongKongTime";

import {
  DELETE_CONFIRMATION,
  deleteTestDataSummary,
  labels,
} from "./labels";

// Touching boundaries are allowed. A sitting that ends at 10:00 does not
// clash with one that starts at 10:00. Nested and partial overlaps do clash.
export const TOUCHING_BOUNDARIES_ALLOWED = true;

export type SittingWindow = {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  archivedAt: string | null;
};

export type SittingControls = {
  archive: boolean;
  restore: boolean;
  deleteTime: boolean;
  deleteTestData: boolean;
  editTime: boolean;
};

export function displaySlotName(slot: {
  label: string;
  archivedAt?: string | null;
}): string {
  const name = slot.label.trim() || "Sitting";
  return slot.archivedAt ? labels.archivedSuffix(name) : name;
}

export function activeSittings<T extends { archivedAt: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => row.archivedAt == null);
}

export function archivedSittings<T extends { archivedAt: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => row.archivedAt != null);
}

export function sittingControls(input: {
  locked: boolean;
  archived: boolean;
  isAdmin: boolean;
  canManage: boolean;
  archiveSupported: boolean;
}): SittingControls {
  return {
    archive: input.canManage && input.archiveSupported && !input.archived,
    restore: input.canManage && input.archiveSupported && input.archived,
    deleteTime: input.isAdmin && !input.locked,
    deleteTestData: input.isAdmin && input.locked,
    editTime: input.canManage && !input.locked,
  };
}

export function countStudents(rows: Array<{ studentId: string | null }>): number {
  const ids = new Set<string>();
  let anonymous = 0;
  for (const row of rows) {
    if (row.studentId) ids.add(row.studentId);
    else anonymous += 1;
  }
  return ids.size + anonymous;
}

export function canConfirmDelete(typed: string): boolean {
  return typed === DELETE_CONFIRMATION;
}

export { deleteTestDataSummary };

function rangeMs(startsAt: string, endsAt: string): { start: number; end: number } | null {
  const start = parseHongKongDateTime(startsAt);
  const end = parseHongKongDateTime(endsAt);
  if (start == null || end == null || !(end > start)) return null;
  return { start, end };
}

export function findClashes(
  candidate: { startsAt: string; endsAt: string },
  slots: SittingWindow[],
  ignoreId?: string,
): SittingWindow[] {
  const mine = rangeMs(candidate.startsAt, candidate.endsAt);
  if (!mine) return [];
  return slots.filter((slot) => {
    if (ignoreId && slot.id === ignoreId) return false;
    const other = rangeMs(slot.startsAt, slot.endsAt);
    if (!other) return false;
    return mine.start < other.end && mine.end > other.start;
  });
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function overlapMessage(names: string[]): string | null {
  if (names.length === 0) return null;
  return labels.overlaps(joinAnd(names));
}

export function clashMessage(
  candidate: { startsAt: string; endsAt: string },
  slots: SittingWindow[],
  ignoreId?: string,
): string | null {
  return overlapMessage(findClashes(candidate, slots, ignoreId).map(displaySlotName));
}

export function existingOverlapWarning(slots: SittingWindow[]): string | null {
  const sentences: string[] = [];
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const clashes = findClashes(slots[i], [slots[j]]);
      if (clashes.length > 0) {
        sentences.push(
          labels.pairOverlaps(displaySlotName(slots[i]), displaySlotName(slots[j])),
        );
      }
    }
  }
  if (sentences.length === 0) return null;
  return sentences.join(" ");
}

export function frozenMinutesMessage(minutes: number[]): string {
  const shown = minutes.filter((minute) => Number.isInteger(minute) && minute > 0);
  if (shown.length === 0) return labels.frozenNoNumbers;
  return labels.frozenAt(joinAnd(shown.map(String)));
}

export function subjectSettingsMessage(
  settings: { Math: number; Chinese: number } | null,
): string {
  if (!settings) return labels.subjectSettingsUnknown;
  return labels.subjectSettings(settings.Math, settings.Chinese);
}

export function sectionSourceText(input: {
  subject: string | null;
  questionSet: string;
}): string {
  if (input.subject === "Math") return labels.mathBank;
  if (input.subject === "Chinese") return labels.chineseBank;
  const name = input.questionSet.trim();
  if (!name) return labels.noQuestionSource;
  return labels.legacySetUsed(name);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function hongKongDayKeyFromMs(ms: number): string {
  const parts = hongKongParts(ms);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function toHongKongDatetimeLocal(value: string): string {
  const ms = parseHongKongDateTime(value);
  if (ms == null) return "";
  const parts = hongKongParts(ms);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function shiftDayKey(dayKey: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return dayKey;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + delta);
  const date = new Date(utc);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function defaultTimelineDay(dayKeys: string[], todayKey: string): string {
  const unique = [...new Set(dayKeys)].filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  if (unique.includes(todayKey)) return todayKey;
  const upcoming = unique.find((day) => day >= todayKey);
  return upcoming ?? unique[unique.length - 1] ?? todayKey;
}

export function formatDayKey(dayKey: string): string {
  const ms = parseHongKongDateTime(`${dayKey}T12:00:00`);
  if (ms == null) return dayKey;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

export function hourLabel(hour: number): string {
  return `${pad(hour)}:00`;
}

export type DayBlock = {
  id: string;
  label: string;
  left: number;
  width: number;
  overlaps: boolean;
  draft: boolean;
  href: string | null;
};

export type DayRow = {
  id: string;
  label: string;
  blocks: DayBlock[];
};

export type DayTimeline = {
  day: string;
  hours: number[];
  rows: DayRow[];
  draftOnAnotherDay: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStartMs(dayKey: string): number | null {
  return parseHongKongDateTime(`${dayKey}T00:00:00`);
}

function clipToDay(
  startsAt: string,
  endsAt: string,
  dayKey: string,
): { start: number; end: number } | null {
  const startMs = parseHongKongDateTime(startsAt);
  const endMs = parseHongKongDateTime(endsAt);
  const origin = dayStartMs(dayKey);
  if (startMs == null || endMs == null || origin == null || !(endMs > startMs)) return null;
  const clipStart = Math.max(startMs, origin);
  const clipEnd = Math.min(endMs, origin + DAY_MS);
  if (!(clipEnd > clipStart)) return null;
  return {
    start: (clipStart - origin) / 60_000,
    end: (clipEnd - origin) / 60_000,
  };
}

function intervalsOverlap(
  left: { start: number; end: number },
  right: { start: number; end: number },
): boolean {
  return left.start < right.end && left.end > right.start;
}

export function buildDayTimeline(input: {
  day: string;
  slots: SittingWindow[];
  clashSlots: SittingWindow[];
  draft: { startsAt: string; endsAt: string } | null;
}): DayTimeline {
  const draftClip = input.draft
    ? clipToDay(input.draft.startsAt, input.draft.endsAt, input.day)
    : null;
  const draftValid = input.draft
    ? rangeMs(input.draft.startsAt, input.draft.endsAt) != null
    : false;

  const placed = input.slots.flatMap((slot) => {
    const clip = clipToDay(slot.startsAt, slot.endsAt, input.day);
    return clip ? [{ slot, clip }] : [];
  });

  const clips = [
    ...placed.map((row) => row.clip),
    ...(draftClip ? [draftClip] : []),
  ];

  let startHour = 0;
  let endHour = 0;
  if (clips.length > 0) {
    const min = Math.min(...clips.map((clip) => clip.start));
    const max = Math.max(...clips.map((clip) => clip.end));
    startHour = Math.max(0, Math.min(23, Math.floor(min / 60)));
    endHour = Math.max(startHour + 1, Math.min(24, Math.ceil(max / 60)));
  }
  const origin = startHour * 60;
  const span = Math.max(60, (endHour - startHour) * 60);
  const hours =
    clips.length === 0
      ? []
      : Array.from({ length: endHour - startHour }, (_, index) => startHour + index);

  function overlapsOnDay(
    clip: { start: number; end: number },
    selfId: string | null,
  ): boolean {
    const others = input.clashSlots.filter((slot) => slot.id !== selfId);
    if (
      others.some((slot) => {
        const other = clipToDay(slot.startsAt, slot.endsAt, input.day);
        return other != null && intervalsOverlap(clip, other);
      })
    ) {
      return true;
    }
    if (selfId != null && draftClip && intervalsOverlap(clip, draftClip)) return true;
    if (selfId == null) {
      return input.clashSlots.some((slot) => {
        const other = clipToDay(slot.startsAt, slot.endsAt, input.day);
        return other != null && intervalsOverlap(clip, other);
      });
    }
    return false;
  }

  const rows: DayRow[] = placed.map(({ slot, clip }) => ({
    id: slot.id,
    label: displaySlotName(slot),
    blocks: [
      {
        id: slot.id,
        label: displaySlotName(slot),
        left: ((clip.start - origin) / span) * 100,
        width: ((clip.end - clip.start) / span) * 100,
        overlaps: overlapsOnDay(clip, slot.id),
        draft: false,
        href: `#sitting-${slot.id}`,
      },
    ],
  }));

  if (draftClip) {
    rows.push({
      id: "draft",
      label: labels.newTime,
      blocks: [
        {
          id: "draft",
          label: labels.newTime,
          left: ((draftClip.start - origin) / span) * 100,
          width: ((draftClip.end - draftClip.start) / span) * 100,
          overlaps: overlapsOnDay(draftClip, null),
          draft: true,
          href: null,
        },
      ],
    });
  }

  return {
    day: input.day,
    hours,
    rows,
    draftOnAnotherDay: draftValid && draftClip == null,
  };
}
