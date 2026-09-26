import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { isGradeStale, orderByAssigned, scoreResponses } from "../../../gradeScore";
import { CorrectionActions, FinalizeGradeButton } from "./GradeControls";

export const instant = false;

type Nested<T> = T | T[] | null | undefined;

function asSingle<T>(value: Nested<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function correctnessLabel(value: boolean | null) {
  if (value === true) return "correct";
  if (value === false) return "incorrect";
  return "not graded";
}

export default async function StudentGradePage({
  params,
}: {
  params: Promise<{ examId: string; instanceId: string }>;
}) {
  const { examId, instanceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const { data: instance, error: instanceError } = await supabase
    .from("test_instances")
    .select(
      `
      id,
      student_id,
      exam_id,
      status,
      submitted_at,
      assigned_question_ids,
      students!inner ( name, application_number ),
      exams!inner ( name )
    `,
    )
    .eq("id", instanceId)
    .eq("exam_id", examId)
    .single();

  if (instanceError || !instance) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Student sitting not found</h1>
      </main>
    );
  }

  const { data: responseRows, error: responsesError } = await supabase
    .from("responses")
    .select(
      `
      id,
      question_id,
      student_answer,
      is_correct,
      graded_by,
      needs_review,
      questions!inner ( question_text, type, category )
    `,
    )
    .eq("test_instance_id", instanceId);

  const { data: gradeRows } = await supabase
    .from("grades")
    .select("final_grade, finalized_at")
    .eq("student_id", instance.student_id)
    .eq("exam_id", examId)
    .order("finalized_at", { ascending: false })
    .limit(1);
  const grade = gradeRows?.[0] ?? null;

  const student = asSingle(instance.students);
  const exam = asSingle(instance.exams);

  const responses = orderByAssigned(
    (responseRows ?? []).map((row) => {
      const question = asSingle(row.questions);
      return {
        id: row.id,
        question_id: row.question_id,
        student_answer: row.student_answer,
        is_correct: row.is_correct,
        graded_by: row.graded_by,
        needs_review: row.needs_review,
        question_text: question?.question_text ?? "Unknown question",
        type: question?.type ?? "unknown",
        category: question?.category ?? "",
      };
    }),
    instance.assigned_question_ids,
  );

  const score = scoreResponses(responses);
  const stale = grade ? isGradeStale(grade.final_grade, score) : false;
  const assignedCount = Array.isArray(instance.assigned_question_ids)
    ? instance.assigned_question_ids.length
    : null;

  return (
    <main className="p-8">
      <header className="mb-8">
        <p className="mb-2 text-sm">
          <Link href={`/admin/exams/${examId}/grades`} className="underline">
            Back to grades
          </Link>
        </p>
        <h1 className="text-2xl font-bold">
          {student?.name?.trim() || student?.application_number || "Student"}
        </h1>
        <p className="text-muted-foreground">
          {student?.application_number} · {exam?.name ?? "Exam"}
        </p>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Grade</CardTitle>
          <CardDescription>
            Final grade is the percentage of responses marked correct.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            {score.correct}/{score.total} correct
            {score.percent !== null ? ` (${score.percent}%)` : ""}
          </p>
          {assignedCount !== null && assignedCount !== score.total ? (
            <p className="text-sm text-muted-foreground">
              {score.total} of {assignedCount} assigned questions were answered.
              Unanswered questions have no response and are not counted.
            </p>
          ) : null}
          {score.pendingReview > 0 ? (
            <p className="text-sm text-destructive">
              {score.pendingReview} response
              {score.pendingReview === 1 ? " needs" : "s need"} review before
              this grade can be finalized.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {grade ? (
              <Badge>
                Finalized {Number(grade.final_grade)}%
                {grade.finalized_at
                  ? ` · ${new Date(grade.finalized_at).toLocaleString()}`
                  : ""}
              </Badge>
            ) : (
              <Badge variant="secondary">Not finalized</Badge>
            )}
            {stale ? (
              <Badge variant="destructive">Changed since finalize</Badge>
            ) : null}
          </div>
        </CardContent>
        {isAdmin && instance.status === "submitted" ? (
          <CardFooter>
            <FinalizeGradeButton
              examId={examId}
              instanceId={instanceId}
              alreadyFinalized={Boolean(grade)}
            />
          </CardFooter>
        ) : null}
      </Card>

      {responsesError ? (
        <p>Failed to load responses.</p>
      ) : responses.length === 0 ? (
        <p>No responses recorded for this sitting.</p>
      ) : (
        <ul className="space-y-6">
          {responses.map((response, index) => (
            <li key={response.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    {index + 1}. {response.question_text}
                  </CardTitle>
                  <CardDescription>
                    {response.type} · {response.category}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-base">
                    {response.student_answer?.trim()
                      ? response.student_answer
                      : "(empty answer)"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        response.is_correct === true ? "default" : "secondary"
                      }
                    >
                      {correctnessLabel(response.is_correct)}
                    </Badge>
                    <Badge variant="outline">
                      graded by {response.graded_by ?? "unknown"}
                    </Badge>
                    {response.needs_review ? (
                      <Badge variant="destructive">Needs review</Badge>
                    ) : null}
                  </div>
                </CardContent>
                {isAdmin ? (
                  <CardFooter>
                    <CorrectionActions
                      responseId={response.id}
                      examId={examId}
                      instanceId={instanceId}
                      isCorrect={response.is_correct}
                    />
                  </CardFooter>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
