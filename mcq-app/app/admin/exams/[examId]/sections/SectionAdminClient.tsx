"use client";

import { T, TText } from "@/app/admin/T";
import { phraseNow } from "@/app/admin/usePhrase";

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

import { labels } from "../../../schedule/labels";
import { sectionSourceText } from "../../../schedule/sittingRules";
import {
  positionsAreContiguous,
  validateSectionFields,
} from "../../sectionValidation";
import type { SectionActionResult } from "./actions";

export type SectionRow = {
  id: string;
  label: string;
  question_set: string;
  subject?: string | null;
  duration_minutes: number;
  position: number;
  duration_locked?: boolean;
  duration_note?: string | null;
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
  renumberSections: (formData: FormData) => Promise<SectionActionResult>;
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
  renumberSections,
}: SectionAdminClientProps) {
  const hasPositionGap = !positionsAreContiguous(
    sections.map((section) => section.position),
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle><T id="schedule.page.createSection" /></CardTitle>
          <CardDescription><TText text={labels.sectionsCreateHelp} /></CardDescription>
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
          <CardTitle><T id="shell.copy.sections" /></CardTitle>
        </CardHeader>
        <CardContent>
          {hasPositionGap ? (
            <div className="mb-6 space-y-3">
              <p className="text-sm text-destructive">
                These sections are not in a continuous order. Students cannot
                start this exam until the numbering has no gaps.
              </p>
              <RenumberSectionsButton
                examId={examId}
                action={renumberSections}
              />
            </div>
          ) : null}
          {loadError ? (
            <p className="text-sm text-destructive"><TText text={loadError} /></p>
          ) : sections.length === 0 ? (
            <p><T id="schedule.page.noSections" /></p>
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
                    <TText
                      text={sectionSourceText({
                        subject: section.subject ?? null,
                        questionSet: section.question_set,
                      })}
                    />
                    {" · "}
                    <TText
                      text={
                        section.duration_minutes === 1
                          ? "1 minute"
                          : `${section.duration_minutes} minutes`
                      }
                    />
                    {section.duration_note ? (
                      <>
                        {" · "}
                        <TText text={section.duration_note} />
                      </>
                    ) : null}
                  </p>
                  <SectionForm
                    key={`${section.id}-${section.label}-${section.question_set}-${section.duration_minutes}-${section.duration_locked ? "locked" : "open"}`}
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
                    <p className="text-sm text-muted-foreground"><T id="schedule.page.adminDeleteSection" /></p>
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
  const bankSubject = initial?.subject === "Math" || initial?.subject === "Chinese";

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
        <Label htmlFor={`${listId}-label`}><T id="schedule.page.label" /></Label>
        <Input
          id={`${listId}-label`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
        />
      </div>
      {bankSubject ? (
        <p className="text-sm text-muted-foreground">
          {sectionSourceText({
            subject: initial?.subject ?? null,
            questionSet: questionSet,
          })}
        </p>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor={`${listId}-set`}><TText text={labels.legacyQuestionSet} /></Label>
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
          <p className="text-sm text-muted-foreground"><TText text={labels.legacyQuestionSetHelp} /></p>
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${listId}-duration`}><T id="shell.copy.durationMinutes" /></Label>
        <Input
          id={`${listId}-duration`}
          inputMode="numeric"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
          readOnly={initial?.duration_locked === true}
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive"><TText text={error} /></p> : null}
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <TText text={pendingLabel} /> : <TText text={submitLabel} />}
        </Button>
      </div>
    </form>
  );
}

function RenumberSectionsButton({
  examId,
  action,
}: {
  examId: string;
  action: (formData: FormData) => Promise<SectionActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRenumber() {
    setError(null);
    const formData = new FormData();
    formData.set("exam_id", examId);
    setIsSubmitting(true);
    const result = await action(formData);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={isSubmitting}
        onClick={() => void handleRenumber()}
      >
        {isSubmitting ? <T id="shell.copy.renumbering" /> : <T id="schedule.page.renumber" />}
      </Button>
      {error ? <p className="text-sm text-destructive"><TText text={error} /></p> : null}
    </div>
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
      {error ? <p className="text-sm text-destructive"><TText text={error} /></p> : null}
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
    if (!window.confirm(phraseNow(`Delete section “${label}”?`))) return;
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
        {isSubmitting ? <T id="shell.copy.deleting" /> : <T id="shell.copy.delete" />}
      </Button>
      {error ? <p className="text-sm text-destructive"><TText text={error} /></p> : null}
    </div>
  );
}
