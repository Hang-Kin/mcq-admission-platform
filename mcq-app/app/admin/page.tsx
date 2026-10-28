import Link from "next/link";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { isMissingSchema } from "./bank/schemaError";
import {
  markPrimary,
  nextExamId,
  qrChecklist,
  questionsChecklist,
  resultsChecklist,
  sittingsChecklist,
  type ChecklistStep,
  type ExamFact,
  type QuestionFact,
  type SittingFact,
  type SlotFact,
} from "./homeChecklist";
import {
  DEFAULT_QUESTIONS_PER_TOPIC,
  type SubjectId,
} from "./settings/subjectSettings";

export const instant = false;

function perTopicValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(String(value ?? ""));
  if (!Number.isInteger(number) || number < 1) return DEFAULT_QUESTIONS_PER_TOPIC;
  return number;
}

function formatStart(startsAt: string): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "soon";
  const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (startDay === today) return `today at ${time}`;
  if (startDay === today + day) return `tomorrow at ${time}`;
  const date = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${date} at ${time}`;
}

export default async function AdminHome() {
  await connection();
  const nowMs = Date.now();
  const supabase = await createClient();

  const [
    questionsResult,
    settingsResult,
    slotsResult,
    drawsResult,
    startedResult,
    examsResult,
    studentsResult,
    instancesResult,
    reviewResult,
  ] = await Promise.all([
    supabase.from("questions").select("subject, category").in("subject", ["Math", "Chinese"]),
    supabase.from("subject_settings").select("subject, questions_per_category"),
    supabase.from("timeslots").select("id, label, starts_at, ends_at, exam_id"),
    supabase.from("timeslot_draws").select("timeslot_id"),
    supabase.from("test_instances").select("timeslot_id").not("started_at", "is", null),
    supabase.from("exams").select("id, created_at"),
    supabase.from("students").select("id"),
    supabase.from("test_instances").select("exam_id, student_id"),
    supabase
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("needs_review", true),
  ]);

  const questionsMissing =
    isMissingSchema(questionsResult.error) || isMissingSchema(settingsResult.error);
  const questionsFailed =
    (Boolean(questionsResult.error) || Boolean(settingsResult.error)) && !questionsMissing;
  const perTopic: Record<SubjectId, number> = {
    Math: DEFAULT_QUESTIONS_PER_TOPIC,
    Chinese: DEFAULT_QUESTIONS_PER_TOPIC,
  };
  for (const row of settingsResult.data ?? []) {
    const subject = String(row.subject ?? "");
    if (subject === "Math" || subject === "Chinese") {
      perTopic[subject] = perTopicValue(row.questions_per_category);
    }
  }
  const questions: QuestionFact[] = (questionsResult.data ?? []).map((row) => ({
    subject: String(row.subject ?? ""),
    category: row.category == null ? null : String(row.category),
  }));

  const drawsMissing = isMissingSchema(drawsResult.error);
  const sittingsMissing = drawsMissing;
  const sittingsFailed =
    Boolean(slotsResult.error) ||
    (Boolean(drawsResult.error) && !drawsMissing) ||
    (Boolean(startedResult.error) && !isMissingSchema(startedResult.error));
  const preparedIds = new Set(
    (drawsResult.data ?? []).map((row) => String(row.timeslot_id ?? "")).filter(Boolean),
  );
  const lockedIds = new Set(
    (startedResult.error ? [] : (startedResult.data ?? []))
      .map((row) => row.timeslot_id)
      .filter((id): id is string => Boolean(id))
      .map(String),
  );
  const sittings: SittingFact[] = (slotsResult.data ?? []).map((slot) => ({
    label: String(slot.label ?? ""),
    startsAt: slot.starts_at,
    prepared: preparedIds.has(String(slot.id)),
    locked: lockedIds.has(String(slot.id)),
  }));

  const slots: SlotFact[] = (slotsResult.data ?? []).map((slot) => ({
    examId: slot.exam_id,
    endsAt: slot.ends_at,
  }));
  const exams: ExamFact[] = (examsResult.data ?? []).map((exam) => ({
    id: String(exam.id),
    createdAt: exam.created_at,
  }));
  const examId = nextExamId(slots, exams, nowMs);
  const studentIds = new Set((studentsResult.data ?? []).map((student) => String(student.id)));
  const codedStudentIds = new Set(
    (instancesResult.data ?? [])
      .filter((row) => examId != null && String(row.exam_id) === examId)
      .map((row) => String(row.student_id ?? ""))
      .filter((id) => studentIds.has(id)),
  );
  const qrFailed =
    Boolean(studentsResult.error) ||
    Boolean(instancesResult.error) ||
    Boolean(examsResult.error) ||
    Boolean(slotsResult.error);

  const steps = markPrimary([
    questionsChecklist({
      missing: questionsMissing,
      failed: questionsFailed,
      questions,
      perTopic,
    }),
    sittingsChecklist({
      missing: sittingsMissing,
      failed: sittingsFailed && !sittingsMissing,
      sittings,
      nowMs,
      when: formatStart,
    }),
    qrChecklist({
      failed: qrFailed,
      hasExam: examId != null,
      studentCount: studentsResult.error ? 0 : studentIds.size,
      codedStudentCount: codedStudentIds.size,
    }),
    resultsChecklist({
      failed: Boolean(reviewResult.error),
      waiting: reviewResult.count ?? 0,
    }),
  ]);

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl">Home</h1>
        <p className="text-sm text-muted-foreground">Work through these in order.</p>
      </div>
      <ol className="divide-y divide-border border-y border-border">
        {steps.map((step, index) => (
          <ChecklistRow key={step.title} index={index + 1} step={step} />
        ))}
      </ol>
    </main>
  );
}

function ChecklistRow({
  index,
  step,
}: {
  index: number;
  step: ChecklistStep & { primary: boolean };
}) {
  return (
    <li className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg">
            {index}. {step.title}
          </h2>
          <p className="text-sm text-muted-foreground">{step.status}</p>
        </div>
        <p className={step.warn ? "text-sm text-destructive" : "text-sm text-foreground"}>
          {step.detail}
        </p>
      </div>
      <Button asChild variant={step.primary ? "default" : "outline"} className="h-12 shrink-0 px-5 text-base">
        <Link href={step.href}>{step.action}</Link>
      </Button>
    </li>
  );
}
