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

import { saveSubjectSettings } from "./actions";
import { parsePositiveInteger, questionTotal, type SubjectId } from "./subjectSettings";

export type SubjectSettingValues = {
  id: SubjectId;
  title: string;
  topicCount: number;
  questionsPerTopic: number;
  minutes: number;
};

const fieldClass = "h-12 text-base md:text-base";

export function SettingsForm({ subjects }: { subjects: SubjectSettingValues[] }) {
  const [questions, setQuestions] = useState<Record<string, string>>(() =>
    Object.fromEntries(subjects.map((subject) => [subject.id, String(subject.questionsPerTopic)])),
  );
  const [minutes, setMinutes] = useState<Record<string, string>>(() =>
    Object.fromEntries(subjects.map((subject) => [subject.id, String(subject.minutes)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    for (const subject of subjects) {
      formData.set(`${subject.id}-questions`, questions[subject.id] ?? "");
      formData.set(`${subject.id}-minutes`, minutes[subject.id] ?? "");
    }
    setIsSubmitting(true);
    try {
      const result = await saveSubjectSettings(formData);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {subjects.map((subject) => {
          const perTopic = parsePositiveInteger(
            questions[subject.id] ?? "",
            "Questions per topic",
          );
          const total = perTopic.ok
            ? questionTotal(subject.topicCount, perTopic.value)
            : "Enter a whole number greater than 0.";
          return (
            <Card key={subject.id} className="min-h-64">
              <CardHeader>
                <CardTitle className="text-2xl">{subject.title}</CardTitle>
                <CardDescription className="text-base">{total}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${subject.id}-questions`}>Questions per topic</Label>
                  <Input
                    id={`${subject.id}-questions`}
                    inputMode="numeric"
                    value={questions[subject.id] ?? ""}
                    onChange={(event) =>
                      setQuestions((current) => ({
                        ...current,
                        [subject.id]: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${subject.id}-minutes`}>Time (minutes)</Label>
                  <Input
                    id={`${subject.id}-minutes`}
                    inputMode="numeric"
                    value={minutes[subject.id] ?? ""}
                    onChange={(event) =>
                      setMinutes((current) => ({
                        ...current,
                        [subject.id]: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? (
        <p className="text-sm text-primary" role="status">
          {success}
        </p>
      ) : null}
      <Button type="submit" className="h-12 px-5 text-base" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
