"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

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

import { API_ERROR_COPY, validateGeneratePicker } from "./qrValidation";
import type { QrStudent, QuestionSetOption } from "./qrTypes";

type CreatedRow = { studentId: string; token: string };

function studentLabel(student: QrStudent) {
  return student.name?.trim() || student.application_number;
}

function statusLabel(status: QrStudent["instanceStatus"]) {
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

function sessionUrl(token: string) {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const origin =
    fromEnv && fromEnv.length > 0 ? fromEnv : window.location.origin;
  return `${origin}/session/${token}`;
}

export function QrGeneratorClient({
  examId,
  students,
  questionSets,
}: {
  examId: string;
  students: QrStudent[];
  questionSets: QuestionSetOption[];
}) {
  const studentsById = useMemo(() => {
    return new Map(students.map((student) => [student.id, student]));
  }, [students]);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>(
    questionSets[0] ? [questionSets[0].name] : [],
  );
  const [questionCount, setQuestionCount] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [created, setCreated] = useState<CreatedRow[] | null>(null);
  const [skipped, setSkipped] = useState<string[] | null>(null);

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
    setSelectedStudentIds(
      students.filter(isPendingForExam).map((student) => student.id),
    );
  }

  async function generate() {
    setError(null);
    const parsedCount = Number(questionCount);
    const validation = validateGeneratePicker({
      studentIds: selectedStudentIds,
      questionSetNames: selectedSets,
      questionCount: parsedCount,
      availableQuestionCount,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/admin/generate-instance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          studentIds: selectedStudentIds,
          questionSetNames: selectedSets,
          questionCount: parsedCount,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            created?: CreatedRow[];
            skipped?: string[];
          }
        | null;

      if (!response.ok) {
        const code = payload?.error ?? "unknown";
        setError(API_ERROR_COPY[code] ?? "Could not generate QR codes. Try again.");
        setCreated(null);
        setSkipped(null);
        return;
      }

      setCreated(payload?.created ?? []);
      setSkipped(payload?.skipped ?? []);
    } catch {
      setError("Could not generate QR codes. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  const createdCards = (created ?? [])
    .map((row) => {
      const student = studentsById.get(row.studentId);
      if (!student) return null;
      return { ...row, student };
    })
    .filter((row): row is CreatedRow & { student: QrStudent } => row !== null);

  return (
    <div className="space-y-8">
      <div className="qr-no-print space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>
              Students already in progress or submitted will be skipped by the
              server if you still include them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" variant="outline" onClick={selectAllPending}>
              Select all pending for this exam
            </Button>
            {students.length === 0 ? (
              <p>No students in the roster yet.</p>
            ) : (
              <ul className="space-y-3">
                {students.map((student) => {
                  const id = `student-${student.id}`;
                  const blocked = !isPendingForExam(student);
                  return (
                    <li key={student.id} className="flex items-start gap-3">
                      <Checkbox
                        id={id}
                        checked={selectedStudentIds.includes(student.id)}
                        onCheckedChange={(value) =>
                          toggleStudent(student.id, value === true)
                        }
                      />
                      <Label htmlFor={id} className="font-normal leading-snug">
                        <span className="block">{studentLabel(student)}</span>
                        <span className="block text-sm text-muted-foreground">
                          {student.application_number}
                          {" · "}
                          {statusLabel(student.instanceStatus)}
                          {blocked ? " — generate will skip this student" : ""}
                        </span>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

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
                        onCheckedChange={(value) =>
                          toggleSet(set.name, value === true)
                        }
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
            <Button type="button" disabled={isGenerating} onClick={() => void generate()}>
              {isGenerating ? "Generating…" : "Generate QR codes"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {created !== null && skipped !== null ? (
        <section className="space-y-6">
          <div className="qr-no-print flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Results</h2>
            {createdCards.length > 0 ? (
              <Button type="button" variant="outline" onClick={() => window.print()}>
                Print QR sheets
              </Button>
            ) : null}
          </div>

          {createdCards.length === 0 && skipped.length === 0 ? (
            <p>No QR codes were created.</p>
          ) : null}

          {skipped.length > 0 ? (
            <div className="qr-no-print">
              <h3 className="font-medium">Skipped</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                These students already have an active or finished sitting for this
                exam. QR codes were not regenerated.
              </p>
              <ul className="list-disc pl-6">
                {skipped.map((studentId) => {
                  const student = studentsById.get(studentId);
                  return (
                    <li key={studentId}>
                      {student ? studentLabel(student) : studentId}
                      {student
                        ? ` (${statusLabel(student.instanceStatus)})`
                        : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {createdCards.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {createdCards.map(({ student, token }) => {
                const url = sessionUrl(token);
                return (
                  <Card key={token} className="qr-sheet break-inside-avoid">
                    <CardHeader>
                      <CardTitle>{studentLabel(student)}</CardTitle>
                      <CardDescription>
                        {student.application_number}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4">
                      <QRCodeSVG value={url} size={200} />
                      <p className="w-full break-all text-center text-sm">{url}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
