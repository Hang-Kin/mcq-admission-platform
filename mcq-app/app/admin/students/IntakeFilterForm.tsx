"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { fieldClassName } from "./fieldClass";
import { formatIntakeLabel } from "./intakeLabel";

export function IntakeFilterForm({
  intakes,
  selectedIntake,
}: {
  intakes: string[];
  selectedIntake: string;
}) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <form
      action="/admin/students"
      className="flex max-w-xl flex-wrap items-end gap-3"
      onSubmit={() => setPending(true)}
    >
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <Label htmlFor="intake-filter">Intake</Label>
        <select
          id="intake-filter"
          name="intake"
          defaultValue={selectedIntake}
          className={fieldClassName}
        >
          <option value="">All intakes</option>
          {intakes.map((intake) => (
            <option key={intake} value={intake}>
              {formatIntakeLabel(intake)}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" pending={pending} pendingLabel="Showing…">
        Show
      </Button>
    </form>
  );
}
