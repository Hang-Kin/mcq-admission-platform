"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CreateExamResult } from "./actions";
import { validateExamFields } from "./examValidation";

type ExamFormProps = {
  action: (formData: FormData) => Promise<CreateExamResult>;
};

export function ExamForm({ action }: ExamFormProps) {
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = validateExamFields({ name, durationMinutes });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const formData = new FormData();
    formData.set("name", parsed.payload.name);
    formData.set("duration_minutes", String(parsed.payload.duration_minutes));

    setIsSubmitting(true);
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="duration_minutes">Duration (minutes)</Label>
        <Input
          id="duration_minutes"
          name="duration_minutes"
          inputMode="numeric"
          required
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
          autoComplete="off"
        />
        <p className="text-sm text-muted-foreground">
          This is the timer when the exam has no sections. Each section can
          set its own duration later.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating…" : "Create exam"}
      </Button>
    </form>
  );
}
