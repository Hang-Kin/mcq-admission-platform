export const INTAKE_RE = /^([0-9]{4})-(0[1-9]|1[0-2])$/;
export const APPLICATION_NUMBER_RE = /^[0-9]{4}$/;

export const INTAKE_YEAR_START = 2020;
export const INTAKE_YEAR_END = 2035;

export const INTAKE_YEARS = Array.from(
  { length: INTAKE_YEAR_END - INTAKE_YEAR_START + 1 },
  (_, index) => String(INTAKE_YEAR_START + index),
);

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const INTAKE_MONTHS = MONTH_NAMES.map((label, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label,
}));

export function composeIntake(year: string, month: string): string | null {
  const intake = `${year}-${month}`;
  return INTAKE_RE.test(intake) ? intake : null;
}

export function formatIntakeLabel(intake: string): string | null {
  const match = INTAKE_RE.exec(intake);
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  const monthName = MONTH_NAMES[monthIndex];
  if (!monthName) return null;
  return `${match[1]} ${monthName} Entry`;
}
