export const HONG_KONG_TIME_ZONE = "Asia/Hong_Kong";

const ZONE_SUFFIX = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const WALL_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

export type HongKongParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function hongKongParts(utcMs: number): HongKongParts {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: HONG_KONG_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const bag: Record<string, string> = {};
  for (const part of formatted.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

function zoneOffsetMs(utcMs: number): number {
  const parts = hongKongParts(utcMs);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - utcMs;
}

// A value that already has a zone is an absolute instant.
// A datetime-local value has no zone. Read that wall clock as Hong Kong
// time. Never use the machine's local zone: the server runs in UTC.
export function parseHongKongDateTime(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ZONE_SUFFIX.test(trimmed)) {
    const ms = Date.parse(trimmed);
    return Number.isNaN(ms) ? null : ms;
  }

  const match = WALL_TIME.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = wallAsUtc - zoneOffsetMs(wallAsUtc);
  const refined = wallAsUtc - zoneOffsetMs(utc);
  if (refined !== utc) utc = refined;

  const back = hongKongParts(utc);
  if (
    back.year !== year ||
    back.month !== month ||
    back.day !== day ||
    back.hour !== hour ||
    back.minute !== minute ||
    back.second !== second
  ) {
    return null;
  }
  return utc;
}

function dayLabel(utcMs: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HONG_KONG_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(utcMs));
}

function clock(parts: HongKongParts): string {
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatHongKongDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const ms = parseHongKongDateTime(value);
  if (ms == null) return "";
  return `${dayLabel(ms)}, ${clock(hongKongParts(ms))} HKT`;
}

export function formatHongKongRange(
  starts: string | null | undefined,
  ends: string | null | undefined,
): string {
  if (!starts || !ends) return "";
  const startMs = parseHongKongDateTime(starts);
  const endMs = parseHongKongDateTime(ends);
  if (startMs == null || endMs == null) return "";
  const start = hongKongParts(startMs);
  const end = hongKongParts(endMs);
  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    return `${dayLabel(startMs)}, ${clock(start)}–${clock(end)} HKT`;
  }
  return `${dayLabel(startMs)}, ${clock(start)} HKT – ${dayLabel(endMs)}, ${clock(end)} HKT`;
}
