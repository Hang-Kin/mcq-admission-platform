"use client";

import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CreateStudentResult } from "./actions";

type StudentFormProps = {
  action: (formData: FormData) => Promise<CreateStudentResult>;
};

export function StudentForm({ action }: StudentFormProps) {
  const [name, setName] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("application_number", applicationNumber);

    setIsSubmitting(true);
    const result = await action(formData);
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    setSuccess(`Added ${name.trim()} (${applicationNumber.trim()}).`);
    setName("");
    setApplicationNumber("");
    nameInputRef.current?.focus();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex max-w-xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          ref={nameInputRef}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="application_number">Application number</Label>
        <Input
          id="application_number"
          name="application_number"
          required
          value={applicationNumber}
          onChange={(event) => setApplicationNumber(event.target.value)}
          autoComplete="off"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Adding…" : "Add student"}
      </Button>
    </form>
  );
}
