"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { examNeedsLabel } from "../settings/sectionMinutes";
import { addMathAndChinese, addSittingTime, createNamedExam } from "./sittingsActions";
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
  action = addSittingTime,
}: {
  examId: string;
  prominent: boolean;
  examMinutes?: number;
  action?: Action;
}) {
  const [label, setLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = validateSittingTime({ label, startsAt, endsAt, examMinutes });
    if (!parsed.ok) {
      setError(parsed.error);
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
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="time-end">Ends (HKT)</Label>
          <Input
            id="time-end"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Hong Kong time (HKT).</p>
      {examNeedsLabel(examMinutes) ? (
        <p className="text-sm text-muted-foreground">{examNeedsLabel(examMinutes)}</p>
      ) : null}
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
