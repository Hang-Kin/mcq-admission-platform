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

/** Hong Kong has had no daylight saving since 1979. A fixed offset keeps server and browser text identical. */
const HONG_KONG_OFFSET_MS = 8 * 60 * 60 * 1000;

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function hongKongParts(utcMs: number): HongKongParts {
  const shifted = new Date(utcMs + HONG_KONG_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

export function hongKongWeekdayShort(utcMs: number): string {
  const parts = hongKongParts(utcMs);
  const index = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return WEEKDAYS_EN[index] ?? "";
}

export function hongKongEnglishDate(utcMs: number): string {
  const parts = hongKongParts(utcMs);
  return `${parts.day} ${MONTHS_EN[parts.month - 1] ?? ""} ${parts.year}`;
}

function zoneOffsetMs(_utcMs: number): number {
  return HONG_KONG_OFFSET_MS;
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

export type ClockLocale = "en" | "zh-Hant";

function dayLabel(utcMs: number, locale: ClockLocale = "en"): string {
  const parts = hongKongParts(utcMs);
  if (locale === "zh-Hant") return `${parts.year}年${parts.month}月${parts.day}日`;
  return hongKongEnglishDate(utcMs);
}

/** Hour and minute in Hong Kong, with a Chinese date when the UI language asks for it. */
export function formatHongKongStamp(utcMs: number, locale: ClockLocale = "en"): string {
  const parts = hongKongParts(utcMs);
  const time = `${pad(parts.hour)}:${pad(parts.minute)}`;
  if (locale === "zh-Hant") return `${parts.year}年${parts.month}月${parts.day}日 ${time}`;
  return `${dayLabel(utcMs, "en")}, ${time}`;
}

function clock(parts: HongKongParts): string {
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatHongKongDateTime(
  value: string | null | undefined,
  locale: ClockLocale = "en",
): string {
  if (!value) return "";
  const ms = parseHongKongDateTime(value);
  if (ms == null) return "";
  return `${dayLabel(ms, locale)}, ${clock(hongKongParts(ms))} HKT`;
}

export function formatHongKongRange(
  starts: string | null | undefined,
  ends: string | null | undefined,
  locale: ClockLocale = "en",
): string {
  if (!starts || !ends) return "";
  const startMs = parseHongKongDateTime(starts);
  const endMs = parseHongKongDateTime(ends);
  if (startMs == null || endMs == null) return "";
  const start = hongKongParts(startMs);
  const end = hongKongParts(endMs);
  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    return `${dayLabel(startMs, locale)}, ${clock(start)}–${clock(end)} HKT`;
  }
  return `${dayLabel(startMs, locale)}, ${clock(start)} HKT – ${dayLabel(endMs, locale)}, ${clock(end)} HKT`;
}
