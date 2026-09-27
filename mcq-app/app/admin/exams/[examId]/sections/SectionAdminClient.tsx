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
import { Label } from "@/components/ui/label";

import { validateSectionFields } from "../../sectionValidation";
import type { SectionActionResult } from "./actions";

export type SectionRow = {
  id: string;
  label: string;
  question_set: string;
  duration_minutes: number;
  position: number;
};

type SectionAdminClientProps = {
  examId: string;
  sections: SectionRow[];
  questionSetNames: string[];
  canDelete: boolean;
  loadError: string | null;
  createSection: (formData: FormData) => Promise<SectionActionResult>;
  updateSection: (formData: FormData) => Promise<SectionActionResult>;
  deleteSection: (formData: FormData) => Promise<SectionActionResult>;
  moveSection: (formData: FormData) => Promise<SectionActionResult>;
};

export function SectionAdminClient({
  examId,
  sections,
  questionSetNames,
  canDelete,
  loadError,
  createSection,
  updateSection,
  deleteSection,
  moveSection,
}: SectionAdminClientProps) {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Create section</CardTitle>
          <CardDescription>
            Sections run in order. Each one has its own question set and
            duration. New sections are added at the end.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SectionForm
            examId={examId}
            questionSetNames={questionSetNames}
            submitLabel="Create section"
            pendingLabel="Creating…"
            action={createSection}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : sections.length === 0 ? (
            <p>No sections yet. This exam still uses one timer for the whole sitting.</p>
          ) : (
            <ul className="space-y-6">
              {sections.map((section, index) => (
                <li
                  key={section.id}
                  className="space-y-3 border-b pb-6 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {index + 1}. {section.label}
                    </p>
                    <MoveSectionButtons
                      examId={examId}
                      sectionId={section.id}
                      isFirst={index === 0}
                      isLast={index === sections.length - 1}
                      action={moveSection}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Set {section.question_set} · {section.duration_minutes} min
                  </p>
                  <SectionForm
                    key={`${section.id}-${section.label}-${section.question_set}-${section.duration_minutes}`}
                    examId={examId}
                    sectionId={section.id}
                    questionSetNames={questionSetNames}
                    initial={section}
                    submitLabel="Save changes"
                    pendingLabel="Saving…"
                    action={updateSection}
                  />
                  {canDelete ? (
                    <DeleteSectionButton
                      examId={examId}
                      sectionId={section.id}
                      label={section.label}
                      action={deleteSection}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Only an admin can delete a section.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SectionForm({
  examId,
  sectionId,
  questionSetNames,
  initial,
  submitLabel,
  pendingLabel,
  action,
}: {
  examId: string;
  sectionId?: string;
  questionSetNames: string[];
  initial?: SectionRow;
  submitLabel: string;
  pendingLabel: string;
  action: (formData: FormData) => Promise<SectionActionResult>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [questionSet, setQuestionSet] = useState(initial?.question_set ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    initial ? String(initial.duration_minutes) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const listId = sectionId ? `question-sets-${sectionId}` : "question-sets-new";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = validateSectionFields({
      label,
      questionSet,
      durationMinutes,
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const formData = new FormData();
    formData.set("exam_id", examId);
    if (sectionId) formData.set("section_id", sectionId);
    formData.set("label", parsed.payload.label);
    formData.set("question_set", parsed.payload.question_set);
    formData.set("duration_minutes", String(parsed.payload.duration_minutes));

    setIsSubmitting(true);
    const result = await action(formData);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    if (!sectionId) {
      setLabel("");
      setQuestionSet("");
      setDurationMinutes("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-xl gap-3">
      <div className="grid gap-2">
        <Label htmlFor={`${listId}-label`}>Label</Label>
        <Input
          id={`${listId}-label`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${listId}-set`}>Question set</Label>
        <Input
          id={`${listId}-set`}
          list={listId}
          value={questionSet}
          onChange={(event) => setQuestionSet(event.target.value)}
          required
        />
        <datalist id={listId}>
          {questionSetNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <p className="text-sm text-muted-foreground">
          Must match an existing questions.question_set value (for example{" "}
          {questionSetNames[0] ?? "General"}).
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${listId}-duration`}>Duration (minutes)</Label>
        <Input
          id={`${listId}-duration`}
          inputMode="numeric"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function MoveSectionButtons({
  examId,
  sectionId,
  isFirst,
  isLast,
  action,
}: {
  examId: string;
  sectionId: string;
  isFirst: boolean;
  isLast: boolean;
  action: (formData: FormData) => Promise<SectionActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"up" | "down" | null>(null);

  async function move(direction: "up" | "down") {
    setError(null);
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("section_id", sectionId);
    formData.set("direction", direction);
    setPending(direction);
    const result = await action(formData);
    setPending(null);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFirst || pending !== null}
          onClick={() => void move("up")}
        >
          {pending === "up" ? "Moving…" : "Move up"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLast || pending !== null}
          onClick={() => void move("down")}
        >
          {pending === "down" ? "Moving…" : "Move down"}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function DeleteSectionButton({
  examId,
  sectionId,
  label,
  action,
}: {
  examId: string;
  sectionId: string;
  label: string;
  action: (formData: FormData) => Promise<SectionActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete section “${label}”?`)) return;
    setError(null);
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("section_id", sectionId);
    setIsSubmitting(true);
    const result = await action(formData);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isSubmitting}
        onClick={() => void handleDelete()}
      >
        {isSubmitting ? "Deleting…" : "Delete"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
