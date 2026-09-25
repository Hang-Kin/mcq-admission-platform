"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
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

import {
  automaticTimeslotId,
  overlappingTimeslotLabels,
  validateTimeslotFields,
} from "../../timeslotValidation";
import type { TimeslotActionResult } from "./actions";

export type TimeslotRow = {
  id: string;
  label: string;
  question_set: string;
  starts_at: string;
  ends_at: string;
};

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

type TimeslotAdminClientProps = {
  examId: string;
  examName: string;
  timeslots: TimeslotRow[];
  questionSetNames: string[];
  activeTimeslotOverride: string | null;
  canDelete: boolean;
  createTimeslot: (formData: FormData) => Promise<TimeslotActionResult>;
  updateTimeslot: (formData: FormData) => Promise<TimeslotActionResult>;
  deleteTimeslot: (formData: FormData) => Promise<TimeslotActionResult>;
  setTimeslotOverride: (formData: FormData) => Promise<TimeslotActionResult>;
};

export function TimeslotAdminClient({
  examId,
  examName,
  timeslots,
  questionSetNames,
  activeTimeslotOverride,
  canDelete,
  createTimeslot,
  updateTimeslot,
  deleteTimeslot,
  setTimeslotOverride,
}: TimeslotAdminClientProps) {
  const automaticId = useMemo(
    () => automaticTimeslotId(timeslots),
    [timeslots],
  );
  const automaticSlot = timeslots.find((slot) => slot.id === automaticId);
  const overrideSlot = timeslots.find(
    (slot) => slot.id === activeTimeslotOverride,
  );
  const isManual = Boolean(activeTimeslotOverride);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Active timeslot</CardTitle>
          <CardDescription>
            {examName}: first scan uses the manual override when one is set,
            otherwise the automatic window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {isManual ? (
              <Badge>Manual override</Badge>
            ) : (
              <Badge variant="secondary">Automatic</Badge>
            )}
            {overrideSlot ? (
              <Badge variant="outline">Override: {overrideSlot.label}</Badge>
            ) : null}
            {automaticSlot ? (
              <Badge variant="outline">
                Wall-clock window: {automaticSlot.label}
              </Badge>
            ) : (
              <Badge variant="outline">No automatic window yet</Badge>
            )}
          </div>
          {isManual &&
          automaticSlot &&
          overrideSlot &&
          overrideSlot.id !== automaticSlot.id ? (
            <p className="text-sm text-muted-foreground">
              Manual override ({overrideSlot.label}) and the wall-clock window
              ({automaticSlot.label}) currently disagree. Students will get the
              override until you set this back to None.
            </p>
          ) : null}
          <OverrideForm
            key={activeTimeslotOverride ?? "none"}
            examId={examId}
            timeslots={timeslots}
            activeTimeslotOverride={activeTimeslotOverride}
            action={setTimeslotOverride}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create timeslot</CardTitle>
          <CardDescription>
            Question set must match a value already used on questions
            (free text, not a fixed list). Overlapping windows are allowed,
            but start_session assumes they do not overlap in practice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimeslotForm
            examId={examId}
            questionSetNames={questionSetNames}
            existing={timeslots}
            submitLabel="Create timeslot"
            pendingLabel="Creating…"
            action={createTimeslot}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeslots</CardTitle>
        </CardHeader>
        <CardContent>
          {timeslots.length === 0 ? (
            <p>No timeslots yet. This exam still uses the General set on scan.</p>
          ) : (
            <ul className="space-y-6">
              {timeslots.map((slot) => (
                <li key={slot.id} className="space-y-3 border-b pb-6 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{slot.label}</p>
                    {activeTimeslotOverride === slot.id ? (
                      <Badge>Manual override</Badge>
                    ) : null}
                    {automaticId === slot.id ? (
                      <Badge variant="secondary">Wall-clock window</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Set {slot.question_set} · {formatWhen(slot.starts_at)} →{" "}
                    {formatWhen(slot.ends_at)}
                  </p>
                  <TimeslotForm
                    key={`${slot.id}-${slot.starts_at}-${slot.ends_at}-${slot.label}-${slot.question_set}`}
                    examId={examId}
                    timeslotId={slot.id}
                    questionSetNames={questionSetNames}
                    existing={timeslots}
                    initial={slot}
                    submitLabel="Save changes"
                    pendingLabel="Saving…"
                    action={updateTimeslot}
                  />
                  {canDelete ? (
                    <DeleteTimeslotButton
                      examId={examId}
                      timeslotId={slot.id}
                      label={slot.label}
                      action={deleteTimeslot}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Only an admin can delete a timeslot.
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

function OverrideForm({
  examId,
  timeslots,
  activeTimeslotOverride,
  action,
}: {
  examId: string;
  timeslots: TimeslotRow[];
  activeTimeslotOverride: string | null;
  action: (formData: FormData) => Promise<TimeslotActionResult>;
}) {
  const [value, setValue] = useState(activeTimeslotOverride ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("active_timeslot_override", value);
    setIsSubmitting(true);
    const result = await action(formData);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3">
      <Label htmlFor="active_timeslot_override">Manual override</Label>
      <select
        id="active_timeslot_override"
        name="active_timeslot_override"
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">None (automatic)</option>
        {timeslots.map((slot) => (
          <option key={slot.id} value={slot.id}>
            {slot.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save override"}
        </Button>
      </div>
    </form>
  );
}

function TimeslotForm({
  examId,
  timeslotId,
  questionSetNames,
  existing,
  initial,
  submitLabel,
  pendingLabel,
  action,
}: {
  examId: string;
  timeslotId?: string;
  questionSetNames: string[];
  existing: TimeslotRow[];
  initial?: TimeslotRow;
  submitLabel: string;
  pendingLabel: string;
  action: (formData: FormData) => Promise<TimeslotActionResult>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [questionSet, setQuestionSet] = useState(initial?.question_set ?? "");
  const [startsAt, setStartsAt] = useState(
    initial ? toDatetimeLocalValue(initial.starts_at) : "",
  );
  const [endsAt, setEndsAt] = useState(
    initial ? toDatetimeLocalValue(initial.ends_at) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const listId = timeslotId
    ? `question-sets-${timeslotId}`
    : "question-sets-new";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = validateTimeslotFields({
      label,
      questionSet,
      startsAt,
      endsAt,
    });
    if (!parsed.ok) {
      setError(parsed.error);
      setOverlapWarning(null);
      return;
    }

    const overlaps = overlappingTimeslotLabels(
      { startsAt: parsed.payload.starts_at, endsAt: parsed.payload.ends_at },
      existing,
      timeslotId,
    );
    setOverlapWarning(
      overlaps.length > 0
        ? `This window overlaps ${overlaps.join(", ")}. That is allowed, but first-scan assignment uses the earliest unfinished timeslot.`
        : null,
    );

    const formData = new FormData();
    formData.set("exam_id", examId);
    if (timeslotId) formData.set("timeslot_id", timeslotId);
    formData.set("label", parsed.payload.label);
    formData.set("question_set", parsed.payload.question_set);
    formData.set("starts_at", parsed.payload.starts_at);
    formData.set("ends_at", parsed.payload.ends_at);

    setIsSubmitting(true);
    const result = await action(formData);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    if (!timeslotId) {
      setLabel("");
      setQuestionSet("");
      setStartsAt("");
      setEndsAt("");
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
        <Label htmlFor={`${listId}-start`}>Starts at</Label>
        <Input
          id={`${listId}-start`}
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${listId}-end`}>Ends at</Label>
        <Input
          id={`${listId}-end`}
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          required
        />
      </div>
      {overlapWarning ? (
        <p className="text-sm text-muted-foreground">{overlapWarning}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function DeleteTimeslotButton({
  examId,
  timeslotId,
  label,
  action,
}: {
  examId: string;
  timeslotId: string;
  label: string;
  action: (formData: FormData) => Promise<TimeslotActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete timeslot “${label}”? If it is the manual override, the override will be cleared first.`,
      )
    ) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("timeslot_id", timeslotId);
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
