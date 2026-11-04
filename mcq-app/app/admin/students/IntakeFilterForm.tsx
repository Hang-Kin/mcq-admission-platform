"use client";

import { T } from "@/app/admin/T";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { OptionText, usePhrase } from "@/app/admin/usePhrase";

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
  const tx = usePhrase();

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
        <Label htmlFor="intake-filter"><T id="shell.copy.intake" /></Label>
        <select
          id="intake-filter"
          name="intake"
          defaultValue={selectedIntake}
          className={fieldClassName}
        >
          <option value=""><OptionText text="All intakes" /></option>
          {intakes.map((intake) => (
            <option key={intake} value={intake}>
              <OptionText text={formatIntakeLabel(intake) ?? intake} />
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" pending={pending} pendingLabel={tx("Showing…")}><T id="shell.copy.show" /></Button>
    </form>
  );
}
