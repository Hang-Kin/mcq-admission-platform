import Link from "next/link";

import { INTAKE_WAITING_READ, isMissingSchema } from "@/app/admin/students/schemaError";
import { MathText } from "@/components/MathText";
import { isMissingSubjectColumn, readQuestionSubject } from "@/components/mathText";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { createClient } from "@/lib/supabase/server";

import {
  assignedCountOf,
  isGradeStale,
  scoreResponses,
} from "../exams/gradeScore";
import { ExportForm } from "../results/ExportForm";
import { requireStaff } from "../results/staffGate";

import { ReviewActions } from "./ReviewActions";

export const instant = false;

type Nested<T> = T | T[] | null | undefined;

function asSingle<T>(value: Nested<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type GradeGroup = {
  examId: string;
  examName: string;
  rows: Array<{
    id: string;
    name: string | null;
    applicationNumber: string;
    correct: number;
    total: number;
    pendingReview: number;
    finalized: number | null;
    stale: boolean;
  }>;
};

async function loadGrades(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ failed: boolean; groups: GradeGroup[] }> {
  const { data: instanceRows, error } = await supabase
    .from("test_instances")
    .select(
      `
      id,
      exam_id,
      student_id,
      assigned_question_ids,
      students!inner ( name, application_number ),
      exams!inner ( name ),
      responses ( is_correct, needs_review )
    `,
    )
    .eq("status", "submitted");

  if (error) return { failed: true, groups: [] };

  const { data: gradeRows } = await supabase
    .from("grades")
    .select("exam_id, student_id, final_grade");

  const gradeKey = (examId: string, studentId: string) => `${examId}:${studentId}`;
  const gradeByStudent = new Map(
    (gradeRows ?? []).map((grade) => [
      gradeKey(String(grade.exam_id), String(grade.student_id)),
      grade,
    ]),
  );

  const groups = new Map<string, GradeGroup>();
  for (const instance of instanceRows ?? []) {
    const student = asSingle(instance.students);
    const exam = asSingle(instance.exams);
    const examId = String(instance.exam_id);
    const score = scoreResponses(
      instance.responses ?? [],
      assignedCountOf(instance.assigned_question_ids),
    );
    const grade = gradeByStudent.get(gradeKey(examId, String(instance.student_id))) ?? null;
    const group: GradeGroup = groups.get(examId) ?? {
      examId,
      examName: exam?.name ?? "Exam",
      rows: [],
    };
    group.rows.push({
      id: String(instance.id),
      name: student?.name ?? null,
      applicationNumber: student?.application_number ?? "unknown",
      correct: score.correct,
      total: score.total,
      pendingReview: score.pendingReview,
      finalized: grade ? Number(grade.final_grade) : null,
      stale: grade ? isGradeStale(grade.final_grade, score) : false,
    });
    groups.set(examId, group);
  }

  return {
    failed: false,
    groups: [...groups.values()]
      .map((group) => ({
        ...group,
        rows: group.rows.sort((a, b) => a.applicationNumber.localeCompare(b.applicationNumber)),
      }))
      .sort((a, b) => a.examName.localeCompare(b.examName)),
  };
}

function marker(isCorrect: boolean | null) {
  if (isCorrect === true) return "Correct";
  if (isCorrect === false) return "Incorrect";
  return "Not graded";
}

export default async function ReviewQueuePage() {
  const staff = await requireStaff();
  if (!staff.ok) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl">Results</h1>
        <p className="text-sm text-muted-foreground">{staff.error}</p>
      </main>
    );
  }

  const supabase = staff.supabase;
  const gradesPromise = loadGrades(supabase);
  const examsPromise = supabase.from("exams").select("id, name").order("name", { ascending: true });
  const intakePromise = supabase.from("students").select("intake");
  const withSubject = await supabase
    .from("responses")
    .select(
      `
      id,
      student_answer,
      is_correct,
      needs_review,
      created_at,
      test_instances!inner (
        id,
        students!inner ( name, application_number ),
        exams!inner ( name )
      ),
      questions!inner ( question_text, category, subject, correct_answer )
    `,
    )
    .eq("needs_review", true)
    .order("created_at", { ascending: true });
  const loaded =
    withSubject.error && isMissingSubjectColumn(withSubject.error.message)
      ? await supabase
          .from("responses")
          .select(
            `
      id,
      student_answer,
      is_correct,
      needs_review,
      created_at,
      test_instances!inner (
        id,
        students!inner ( name, application_number ),
        exams!inner ( name )
      ),
      questions!inner ( question_text, category, correct_answer )
    `,
          )
          .eq("needs_review", true)
          .order("created_at", { ascending: true })
      : withSubject;
  const data = loaded.data;
  const error = loaded.error;

  const grades = await gradesPromise;
  const examsResult = await examsPromise;
  const intakeResult = await intakePromise;
  const rows = (data ?? []).map((row) => {
    const instance = asSingle(row.test_instances);
    const student = asSingle(instance?.students);
    const exam = asSingle(instance?.exams);
    const question = asSingle(row.questions);
    return {
      id: row.id,
      instance_id: instance?.id ? String(instance.id) : "",
      student_answer: row.student_answer,
      is_correct: row.is_correct,
      created_at: row.created_at,
      student_name: student?.name ?? null,
      application_number: student?.application_number ?? "unknown",
      exam_name: exam?.name ?? "Unknown exam",
      question_text: question?.question_text ?? "Unknown question",
      category: question?.category ?? "",
      subject: question ? readQuestionSubject(question) : null,
      correct_answer:
        question && "correct_answer" in question && typeof question.correct_answer === "string"
          ? question.correct_answer
          : null,
    };
  });

  const examsFailed = Boolean(examsResult.error);
  const exams = (examsResult.data ?? []).flatMap((exam) => {
    const id = typeof exam.id === "string" ? exam.id : "";
    const name = typeof exam.name === "string" ? exam.name : "";
    return id && name ? [{ id, name }] : [];
  });
  const intakeMissing = Boolean(intakeResult.error && isMissingSchema(intakeResult.error));
  const intakeFailed = Boolean(intakeResult.error && !intakeMissing);
  const intakes = intakeMissing
    ? []
    : [
        ...new Set(
          (intakeResult.data ?? [])
            .map((row) => (typeof row.intake === "string" ? row.intake : ""))
            .filter(Boolean),
        ),
      ].sort();

  return (
    <main className="space-y-10">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl">Results</h1>
        <p className="text-sm text-muted-foreground">
          Scores for submitted sittings, then written answers that still need a teacher.
        </p>
      </div>

      <section className="max-w-3xl space-y-3">
        <h2 className="text-lg">Export</h2>
        <p className="text-sm text-muted-foreground">
          Download submitted results for one exam. Times are Hong Kong time.
        </p>
        {intakeMissing ? (
          <p className="text-sm text-muted-foreground">{INTAKE_WAITING_READ}</p>
        ) : null}
        {intakeFailed ? (
          <p className="text-sm text-destructive">Could not load intakes.</p>
        ) : null}
        {examsFailed ? (
          <p className="text-sm text-destructive">Could not load exams for export.</p>
        ) : exams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exams to export.</p>
        ) : (
          <ExportForm exams={exams} intakes={intakes} intakeReady={!intakeMissing} />
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-lg">Grades</h2>
        {grades.failed ? (
          <p className="text-sm text-destructive">Could not load grades.</p>
        ) : grades.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students have submitted yet.</p>
        ) : (
          grades.groups.map((group) => (
            <div key={group.examId} className="space-y-3">
              <h3 className="text-base">{group.examName}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      <th className="border-b py-3 pr-4">Student</th>
                      <th className="border-b py-3 pr-4">Application number</th>
                      <th className="border-b py-3 pr-4">Score</th>
                      <th className="border-b py-3">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="border-b py-3 pr-4">
                          <div className="flex flex-col gap-1">
                            <Link
                              href={`/admin/exams/${group.examId}/grades/${row.id}`}
                              className="hover:underline"
                            >
                              {row.name?.trim() || row.applicationNumber}
                            </Link>
                            <Link
                              href={`/admin/review/${row.id}`}
                              className="text-sm hover:underline"
                            >
                              Review answers
                            </Link>
                          </div>
                        </td>
                        <td className="border-b py-3 pr-4">{row.applicationNumber}</td>
                        <td className="border-b py-3 pr-4">
                          {row.correct}/{row.total} correct
                          {row.pendingReview > 0 ? ` · ${row.pendingReview} to review` : ""}
                        </td>
                        <td className="border-b py-3">
                          <div className="flex flex-wrap gap-2">
                            {row.finalized != null ? (
                              <Badge>Finalized {row.finalized}%</Badge>
                            ) : (
                              <Badge variant="secondary">Not finalized</Badge>
                            )}
                            {row.stale ? (
                              <Badge variant="destructive">Changed since finalize</Badge>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-lg">Written answers waiting</h2>
          <p className="text-sm text-muted-foreground">
            Text answers waiting for a teacher to mark correct or incorrect.
          </p>
        </div>

      {error ? (
        <p className="text-sm text-destructive">
          Failed to load responses waiting for review.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No written answers to mark.
        </p>
      ) : (
        <ul className="space-y-6">
          {rows.map((row, index) => {
            const subjectLine = [row.subject, row.category].filter(Boolean).join(" · ");
            const wrong = row.is_correct === false;
            return (
            <li key={row.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    {row.student_name?.trim() || row.application_number}
                  </CardTitle>
                  <CardDescription>
                    {row.application_number} · {row.exam_name}
                    {subjectLine ? ` · ${subjectLine}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="leading-relaxed">
                    <MathText
                      text={row.question_text}
                      subject={row.subject}
                      category={row.category}
                    />
                  </p>
                  <div
                    className={
                      wrong
                        ? "space-y-2 rounded-md border border-destructive bg-destructive/10 p-4"
                        : "space-y-2 rounded-md border bg-muted/40 p-4"
                    }
                  >
                    <p className="text-sm font-medium">Student answer</p>
                    <p className="whitespace-pre-wrap text-base">
                      {row.student_answer?.trim() ? row.student_answer : "(empty answer)"}
                    </p>
                  </div>
                  <div className="space-y-2 rounded-md border p-4">
                    <p className="text-sm font-medium">Correct answer</p>
                    <p className="whitespace-pre-wrap text-base">
                      {row.correct_answer?.trim() ? (
                        <MathText
                          text={row.correct_answer}
                          subject={row.subject}
                          category={row.category}
                        />
                      ) : (
                        "(none stored)"
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={
                      row.is_correct === true
                        ? "default"
                        : wrong
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {marker(row.is_correct)}
                  </Badge>
                  {row.instance_id ? (
                    <p className="text-sm">
                      <Link href={`/admin/review/${row.instance_id}`} className="hover:underline">
                        Review all answers
                      </Link>
                    </p>
                  ) : null}
                </CardContent>
                <CardFooter>
                  <ReviewActions responseId={row.id} primary={index === 0} />
                </CardFooter>
              </Card>
            </li>
            );
          })}
        </ul>
      )}
      </section>
    </main>
  );
}
