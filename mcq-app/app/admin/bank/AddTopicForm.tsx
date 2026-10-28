"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { openTopic } from "./actions";
import type { SubjectId } from "./subjects";

export function AddTopicForm({ subject }: { subject: SubjectId }) {
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("topic", topic);
    try {
      const result = await openTopic(subject, formData);
      if (result?.error) setError(result.error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3">
      <Label htmlFor="topic-name">Topic name</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="topic-name"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Fractions"
          className="h-12 text-base md:text-base"
        />
        <Button type="submit" className="h-12 px-5 text-base" disabled={isSubmitting}>
          {isSubmitting ? "Opening…" : "Add a topic"}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
