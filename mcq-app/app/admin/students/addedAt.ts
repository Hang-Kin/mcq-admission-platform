const addedAtFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Hong_Kong",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatAddedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return addedAtFormat.format(date);
}
