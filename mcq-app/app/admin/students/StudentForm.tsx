"use client";

import { T, TText } from "@/app/admin/T";
import { usePhrase } from "@/app/admin/usePhrase";

import { useRef, useState } from "react";

import { SubmitButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CreateStudentResult } from "./actions";
import { IntakeFields } from "./IntakeFields";
import { composeIntake, formatIntakeLabel } from "./intakeLabel";

type StudentFormProps = {
  action: (formData: FormData) => Promise<CreateStudentResult>;
};

export function StudentForm({ action }: StudentFormProps) {
  const [name, setName] = useState("");
  const [chineseName, setChineseName] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const tx = usePhrase();

  async function submit(formData: FormData) {
    setError(null);
    setSuccess(null);
    let result: CreateStudentResult;
    try {
      result = await action(formData);
    } catch {
      setError("Could not add this student. Try again.");
      return;
    }
    if (result?.error) {
      setError(result.error);
      return;
    }

    const savedName = String(formData.get("name") ?? "").trim();
    const savedNumber = String(formData.get("application_number") ?? "").trim();
    const savedChinese = String(formData.get("chinese_name") ?? "").trim();
    const intake = composeIntake(
      String(formData.get("intake_year") ?? ""),
      String(formData.get("intake_month") ?? ""),
    );
    const label = intake ? formatIntakeLabel(intake) : "";
    const extra = [savedChinese, label ?? ""].filter((part) => part.length > 0).join(", ");
    setSuccess(`Added ${savedName} (${savedNumber})${extra ? `, ${extra}` : ""}.`);
    setName("");
    setChineseName("");
    setApplicationNumber("");
    nameInputRef.current?.focus();
  }

  return (
    <form action={submit} className="flex max-w-xl flex-col gap-4">
      <IntakeFields
        year={year}
        month={month}
        onYear={setYear}
        onMonth={setMonth}
        idPrefix="add-intake"
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name"><T id="students.page.fullEnglish" /></Label>
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
        <Label htmlFor="chinese_name"><T id="students.page.chineseNameField" /></Label>
        <Input
          id="chinese_name"
          name="chinese_name"
          value={chineseName}
          onChange={(event) => setChineseName(event.target.value)}
          autoComplete="off"
        />
        <p className="text-sm text-muted-foreground"><T id="shell.copy.optional" /></p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="application_number"><T id="students.page.code" /></Label>
        <Input
          id="application_number"
          name="application_number"
          required
          value={applicationNumber}
          onChange={(event) => setApplicationNumber(event.target.value)}
          autoComplete="off"
          inputMode="text"
          spellCheck={false}
        />
      </div>

      {error ? <p className="text-sm text-destructive"><TText text={error} /></p> : null}
      {success ? <p className="text-sm text-muted-foreground"><TText text={success} /></p> : null}

      <SubmitButton type="submit" variant="outline" pendingLabel={tx("Adding…")}><T id="students.page.addStudent" /></SubmitButton>
    </form>
  );
}
