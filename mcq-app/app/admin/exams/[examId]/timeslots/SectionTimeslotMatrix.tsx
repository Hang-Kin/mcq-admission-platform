"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { sectionTimeslotCellKey } from "../../sectionTimeslotOverrides";
import type { TimeslotActionResult } from "./actions";

export type MatrixSection = {
  id: string;
  label: string;
  question_set: string;
};

export type MatrixTimeslot = {
  id: string;
  label: string;
};

export type MatrixOverride = {
  timeslot_id: string;
  section_id: string;
  question_set: string;
};

type SectionTimeslotMatrixProps = {
  examId: string;
  timeslots: MatrixTimeslot[];
  sections: MatrixSection[];
  overrides: MatrixOverride[];
  questionSetNames: string[];
  canClear: boolean;
  loadError: string | null;
  action: (formData: FormData) => Promise<TimeslotActionResult>;
};

export function SectionTimeslotMatrix({
  examId,
  timeslots,
  sections,
  overrides,
  questionSetNames,
  canClear,
  loadError,
  action,
}: SectionTimeslotMatrixProps) {
  const listId = "section-timeslot-question-sets";
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const slot of timeslots) {
      for (const section of sections) {
        initial[sectionTimeslotCellKey(slot.id, section.id)] = "";
      }
    }
    for (const row of overrides) {
      const key = sectionTimeslotCellKey(row.timeslot_id, row.section_id);
      if (key in initial) initial[key] = row.question_set;
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("exam_id", examId);
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, value);
    }
    setIsSubmitting(true);
    try {
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess("Saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Section question sets</CardTitle>
        <CardDescription>
          Each cell is the question set that section draws during that
          timeslot. Leave a cell blank to use the section default shown in
          the column heading. You do not need to fill every cell.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : timeslots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add timeslots first. Until then, every section uses its own
            default question set.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th className="border-b py-2 pr-4">Timeslot</th>
                    {sections.map((section) => (
                      <th key={section.id} className="border-b py-2 pr-4">
                        <span className="block">{section.label}</span>
                        <span className="block text-sm font-normal text-muted-foreground">
                          Default: {section.question_set}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeslots.map((slot) => (
                    <tr key={slot.id}>
                      <th className="border-b py-2 pr-4 font-medium">
                        {slot.label}
                      </th>
                      {sections.map((section) => {
                        const key = sectionTimeslotCellKey(slot.id, section.id);
                        return (
                          <td key={section.id} className="border-b py-2 pr-4">
                            <Input
                              aria-label={`${slot.label} ${section.label} question set`}
                              list={listId}
                              value={values[key] ?? ""}
                              placeholder="Section default"
                              onChange={(event) =>
                                setValues((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <datalist id={listId}>
              {questionSetNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {canClear ? null : (
              <p className="text-sm text-muted-foreground">
                You can set or change a cell. Only an admin can clear one
                that already has a question set.
              </p>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {success ? (
              <p className="text-sm text-muted-foreground">{success}</p>
            ) : null}
            <div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save section sets"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
