"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { examNeedsLabel } from "../settings/sectionMinutes";
import { labels } from "./labels";
import { clashMessage, toHongKongDatetimeLocal, type SittingWindow } from "./sittingRules";
import { addMathAndChinese, addSittingTime, createNamedExam, updateSittingTime } from "./sittingsActions";
import { validateSittingTime } from "./sittingsFlow";

type Action = (formData: FormData) => Promise<{ error?: string } | void>;

export function CreateExamForm({
  prominent,
  action = createNamedExam,
}: {
  prominent: boolean;
  action?: Action;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    setPending(true);
    const result = await action(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setName("");
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="exam-name">Exam name</Label>
        <Input
          id="exam-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        variant={prominent ? "default" : "outline"}
        className="h-12 w-fit px-5 text-base"
        disabled={pending}
      >
        {pending ? "Creating…" : "Create exam"}
      </Button>
    </form>
  );
}

export function AddSubjectsForm({
  examId,
  prominent,
  action = addMathAndChinese,
}: {
  examId: string;
  prominent: boolean;
  action?: Action;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("exam_id", examId);
    setPending(true);
    const result = await action(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Math and Chinese are not on this exam yet.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        variant={prominent ? "default" : "outline"}
        className="h-12 px-5 text-base"
        disabled={pending}
      >
        {pending ? "Adding…" : "Add Math and Chinese"}
      </Button>
    </form>
  );
}

export function AddTimeForm({
  examId,
  prominent,
  examMinutes = 0,
  peers = [],
  onDraftChange,
  action = addSittingTime,
}: {
  examId: string;
  prominent: boolean;
  examMinutes?: number;
  peers?: SittingWindow[];
  onDraftChange?: (draft: { startsAt: string; endsAt: string }) => void;
  action?: Action;
}) {
  const [label, setLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const liveOverlap = clashMessage({ startsAt, endsAt }, peers);

  function changeDraft(next: { startsAt: string; endsAt: string }) {
    onDraftChange?.(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = validateSittingTime({ label, startsAt, endsAt, examMinutes });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const clash = clashMessage(parsed, peers);
    if (clash) {
      setError(clash);
      return;
    }
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("label", parsed.label);
    formData.set("starts_at", startsAt);
    formData.set("ends_at", endsAt);
    setPending(true);
    const result = await action(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setLabel("");
    setStartsAt("");
    setEndsAt("");
    onDraftChange?.({ startsAt: "", endsAt: "" });
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="time-name">Name</Label>
        <Input
          id="time-name"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          autoComplete="off"
          placeholder="Morning"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="time-start">Starts (HKT)</Label>
          <Input
            id="time-start"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => {
              const value = event.target.value;
              setStartsAt(value);
              changeDraft({ startsAt: value, endsAt });
            }}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="time-end">Ends (HKT)</Label>
          <Input
            id="time-end"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => {
              const value = event.target.value;
              setEndsAt(value);
              changeDraft({ startsAt, endsAt: value });
            }}
            required
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Hong Kong time (HKT).</p>
      {examNeedsLabel(examMinutes) ? (
        <p className="text-sm text-muted-foreground">{examNeedsLabel(examMinutes)}</p>
      ) : null}
      {liveOverlap ? <p className="text-sm text-destructive">{liveOverlap}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        variant={prominent ? "default" : "outline"}
        className="h-12 w-fit px-5 text-base"
        disabled={pending}
      >
        {pending ? "Adding…" : "Add a time"}
      </Button>
    </form>
  );
}

export function EditTimeForm({
  examId,
  sittingId,
  title,
  startsAt,
  endsAt,
  examMinutes = 0,
  peers,
}: {
  examId: string;
  sittingId: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  examMinutes?: number;
  peers: SittingWindow[];
}) {
  const [label, setLabel] = useState(title);
  const [start, setStart] = useState(startsAt ? toHongKongDatetimeLocal(startsAt) : "");
  const [end, setEnd] = useState(endsAt ? toHongKongDatetimeLocal(endsAt) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const liveOverlap = clashMessage({ startsAt: start, endsAt: end }, peers, sittingId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = validateSittingTime({ label, startsAt: start, endsAt: end, examMinutes });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const clash = clashMessage(parsed, peers, sittingId);
    if (clash) {
      setError(clash);
      return;
    }
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("sitting_id", sittingId);
    formData.set("label", parsed.label);
    formData.set("starts_at", start);
    formData.set("ends_at", end);
    setPending(true);
    const result = await updateSittingTime(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4 pt-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`edit-name-${sittingId}`}>Name</Label>
        <Input
          id={`edit-name-${sittingId}`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          autoComplete="off"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`edit-start-${sittingId}`}>Starts (HKT)</Label>
          <Input
            id={`edit-start-${sittingId}`}
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`edit-end-${sittingId}`}>Ends (HKT)</Label>
          <Input
            id={`edit-end-${sittingId}`}
            type="datetime-local"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            required
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{labels.hongKongTime}</p>
      {liveOverlap ? <p className="text-sm text-destructive">{liveOverlap}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="outline" className="h-12 w-fit px-5 text-base" disabled={pending}>
        {pending ? labels.savingTime : labels.saveTime}
      </Button>
    </form>
  );
}
