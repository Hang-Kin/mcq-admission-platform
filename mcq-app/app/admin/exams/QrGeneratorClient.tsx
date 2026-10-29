"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { fieldClassName } from "../students/fieldClass";
import { formatIntakeLabel } from "../students/intakeLabel";
import { API_ERROR_COPY, validateGeneratePicker } from "./qrValidation";
import type { QrStudent, QuestionSetOption } from "./qrTypes";

function studentLabel(student: QrStudent) {
  return student.name?.trim() || student.application_number;
}

function statusLabel(status: QrStudent["instanceStatus"], plainLanguage: boolean) {
  if (plainLanguage) {
    switch (status) {
      case "none":
        return "no code yet";
      case "pending":
        return "code ready";
      case "in_progress":
        return "already started";
      case "submitted":
        return "finished";
      default:
        return status;
    }
  }
  switch (status) {
    case "none":
      return "no sitting yet";
    case "pending":
      return "pending (can regenerate)";
    case "in_progress":
      return "already in progress";
    case "submitted":
      return "already submitted";
    default:
      return status;
  }
}

function isPendingForExam(student: QrStudent) {
  return student.instanceStatus === "none" || student.instanceStatus === "pending";
}

function intakeIdentity(student: QrStudent) {
  const label = student.intake ? formatIntakeLabel(student.intake) : null;
  return [label, student.application_number].filter(Boolean).join(" · ");
}

export function QrGeneratorClient({
  examId,
  students,
  questionSets,
  usesSections = false,
  plainLanguage = false,
  primaryAction = "create",
}: {
  examId: string;
  students: QrStudent[];
  questionSets: QuestionSetOption[];
  usesSections?: boolean;
  plainLanguage?: boolean;
  primaryAction?: "create" | "print" | "none";
}) {
  const intakes = useMemo(() => {
    const values = new Set<string>();
    for (const student of students) {
      if (student.intake && formatIntakeLabel(student.intake)) values.add(student.intake);
    }
    return [...values].sort((a, b) => b.localeCompare(a));
  }, [students]);

  const [intake, setIntake] = useState(intakes[0] ?? "");
  const visible = intake ? students.filter((student) => student.intake === intake) : students;

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>(
    questionSets[0] ? [questionSets[0].name] : [],
  );
  const [questionCount, setQuestionCount] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const availableQuestionCount = questionSets
    .filter((set) => selectedSets.includes(set.name))
    .reduce((sum, set) => sum + set.count, 0);

  function toggleStudent(id: string, checked: boolean) {
    setSelectedStudentIds((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  }

  function toggleSet(name: string, checked: boolean) {
    setSelectedSets((current) =>
      checked ? [...current, name] : current.filter((value) => value !== name),
    );
  }

  function selectAllPending() {
    setSelectedStudentIds(visible.filter(isPendingForExam).map((student) => student.id));
  }

  function changeIntake(value: string) {
    setIntake(value);
    setSelectedStudentIds([]);
    setError(null);
    setMessage(null);
  }

  async function downloadPdf(mode: "create" | "download") {
    setError(null);
    setMessage(null);
    const studentIds = selectedStudentIds.filter((id) => visible.some((student) => student.id === id));
    const parsedCount = Number(questionCount);
    const validation = validateGeneratePicker({
      studentIds,
      questionSetNames: selectedSets,
      questionCount: parsedCount,
      availableQuestionCount,
      usesSections,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setIsWorking(true);
    try {
      const response = await fetch("/api/admin/qr-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          usesSections
            ? { examId, studentIds, mode }
            : {
                examId,
                studentIds,
                mode,
                questionSetNames: selectedSets,
                questionCount: parsedCount,
              },
        ),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("application/pdf")) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const code = payload?.error ?? "unknown";
        if (code === "nothing_to_print" && mode === "create") {
          setError("No new codes. Students who already started were skipped.");
        } else {
          setError(API_ERROR_COPY[code] ?? "Could not download the QR codes. Try again.");
        }
        return;
      }

      const count = Number(response.headers.get("X-Qr-Count") ?? "0");
      const started = Number(response.headers.get("X-Qr-Skipped-Started") ?? "0");
      const missing = Number(response.headers.get("X-Qr-Skipped-Missing") ?? "0");
      const failed = Number(response.headers.get("X-Qr-Skipped-Failed") ?? "0");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
      anchor.href = objectUrl;
      anchor.download = match?.[1] || "qr-codes.pdf";
      anchor.click();
      URL.revokeObjectURL(objectUrl);

      const parts = [`${count} ${count === 1 ? "code" : "codes"} downloaded.`];
      if (started > 0) {
        parts.push(
          started === 1
            ? "1 student was skipped because they already started."
            : `${started} students were skipped because they already started.`,
        );
      }
      if (missing > 0) {
        parts.push(missing === 1 ? "1 student has no code yet." : `${missing} students have no code yet.`);
      }
      if (failed > 0) {
        parts.push(failed === 1 ? "1 code could not be created." : `${failed} codes could not be created.`);
      }
      setMessage(parts.join(" "));
    } catch {
      setError("Could not download the QR codes. Try again.");
    } finally {
      setIsWorking(false);
    }
  }

  const createProminent = !plainLanguage || primaryAction === "create";
  const downloadProminent = plainLanguage && primaryAction === "print";

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>
            Create QR codes downloads a PDF for this intake. Students who already
            started are skipped. A student who has not started gets a new code,
            and any earlier code for them stops working. Download PDF uses the
            current codes and does not replace them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {intakes.length > 0 ? (
            <div className="flex max-w-xs flex-col gap-2">
              <Label htmlFor="qr-intake">Intake</Label>
              <select
                id="qr-intake"
                className={fieldClassName}
                value={intake}
                onChange={(event) => changeIntake(event.target.value)}
              >
                {intakes.map((value) => (
                  <option key={value} value={value}>
                    {formatIntakeLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={selectAllPending}>
            Select all pending for this intake
          </Button>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students in this intake.</p>
          ) : (
            <ul className="space-y-3">
              {visible.map((student) => {
                const id = `student-${student.id}`;
                const blocked = !isPendingForExam(student);
                return (
                  <li key={student.id} className="flex items-start gap-3">
                    <Checkbox
                      id={id}
                      checked={selectedStudentIds.includes(student.id)}
                      onCheckedChange={(value) => toggleStudent(student.id, value === true)}
                    />
                    <Label htmlFor={id} className="font-normal leading-snug">
                      <span className="block">{studentLabel(student)}</span>
                      <span className="block text-sm text-muted-foreground">
                        {intakeIdentity(student)}
                        {" · "}
                        {statusLabel(student.instanceStatus, plainLanguage)}
                        {blocked ? " — a new code will skip this student" : ""}
                      </span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {usesSections ? (
        <Card>
          <CardContent className="space-y-4">
            {plainLanguage ? (
              <p>Math and Chinese are already set. Choose the intake and the students, then download the PDF.</p>
            ) : (
              <p>
                This exam uses sections — question sets are configured on the{" "}
                <Link href={`/admin/exams/${examId}/sections`} className="hover:underline">
                  Sections page
                </Link>
                .
              </p>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-foreground">{message}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant={createProminent ? "default" : "outline"}
                className={plainLanguage ? "h-12 px-5 text-base" : undefined}
                disabled={isWorking}
                onClick={() => void downloadPdf("create")}
              >
                {isWorking ? "Working…" : "Create QR codes"}
              </Button>
              <Button
                type="button"
                variant={downloadProminent ? "default" : "outline"}
                className={plainLanguage ? "h-12 px-5 text-base" : undefined}
                disabled={isWorking}
                onClick={() => void downloadPdf("download")}
              >
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Question draw</CardTitle>
            <CardDescription>
              {availableQuestionCount} question
              {availableQuestionCount === 1 ? "" : "s"} in the selected set(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {questionSets.length === 0 ? (
              <p>No question sets found.</p>
            ) : (
              <ul className="space-y-3">
                {questionSets.map((set) => {
                  const id = `set-${set.name}`;
                  return (
                    <li key={set.name} className="flex items-center gap-3">
                      <Checkbox
                        id={id}
                        checked={selectedSets.includes(set.name)}
                        onCheckedChange={(value) => toggleSet(set.name, value === true)}
                      />
                      <Label htmlFor={id} className="font-normal">
                        {set.name} ({set.count})
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="max-w-xs space-y-2">
              <Label htmlFor="question-count">Questions per student</Label>
              <Input
                id="question-count"
                inputMode="numeric"
                value={questionCount}
                onChange={(event) => setQuestionCount(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-foreground">{message}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={isWorking} onClick={() => void downloadPdf("create")}>
                {isWorking ? "Working…" : "Create QR codes"}
              </Button>
              <Button type="button" variant="outline" disabled={isWorking} onClick={() => void downloadPdf("download")}>
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
