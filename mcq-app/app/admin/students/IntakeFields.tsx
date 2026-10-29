"use client";

import { Label } from "@/components/ui/label";

import { fieldClassName } from "./fieldClass";
import { INTAKE_MONTHS, INTAKE_YEARS } from "./intakeLabel";

export function IntakeFields({
  year,
  month,
  onYear,
  onMonth,
  idPrefix = "intake",
}: {
  year: string;
  month: string;
  onYear: (value: string) => void;
  onMonth: (value: string) => void;
  idPrefix?: string;
}) {
  const yearId = `${idPrefix}-year`;
  const monthId = `${idPrefix}-month`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={yearId}>Year</Label>
        <select
          id={yearId}
          name="intake_year"
          required
          className={fieldClassName}
          value={year}
          onChange={(event) => onYear(event.target.value)}
        >
          <option value="">Year</option>
          {INTAKE_YEARS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={monthId}>Month</Label>
        <select
          id={monthId}
          name="intake_month"
          required
          className={fieldClassName}
          value={month}
          onChange={(event) => onMonth(event.target.value)}
        >
          <option value="">Month</option>
          {INTAKE_MONTHS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
