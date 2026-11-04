import { T } from "@/app/admin/T";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

import {
  assignedCountOf,
  isGradeStale,
  scoreResponses,
} from "../../gradeScore";
import { isMissingMarking } from "../../../results/markSchema";
import { scoreRow } from "../../../results/marking";

export const instant = false;

type Nested<T> = T | T[] | null | undefined;

function asSingle<T>(value: Nested<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function ExamGradesPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, name")
    .eq("id", examId)
    .single();

  const withMarks = await supabase
    .from("test_instances")
    .select(
      `
      id,
      student_id,
      submitted_at,
      assigned_question_ids,
      students!inner ( name, application_number ),
      responses ( is_correct, needs_review, response_marks ( state, override_is_correct, system_mark_known ) )
    `,
    )
    .eq("exam_id", examId)
    .eq("status", "submitted");
  const loadedInstances =
    withMarks.error && isMissingMarking(withMarks.error)
      ? await supabase
          .from("test_instances")
          .select(
            `
      id,
      student_id,
      submitted_at,
      assigned_question_ids,
      students!inner ( name, application_number ),
      responses ( is_correct, needs_review )
    `,
          )
          .eq("exam_id", examId)
          .eq("status", "submitted")
      : withMarks;
  const instanceRows = loadedInstances.data;
  const instancesError = loadedInstances.error;

  const { data: gradeRows } = await supabase
    .from("grades")
    .select("student_id, final_grade, finalized_at")
    .eq("exam_id", examId);

  const gradeByStudent = new Map(
    (gradeRows ?? []).map((grade) => [grade.student_id, grade]),
  );

  const rows = (instanceRows ?? [])
    .map((instance) => {
      const student = asSingle(instance.students);
      const score = scoreResponses(
        (instance.responses ?? []).map((row) => scoreRow(row)),
        assignedCountOf(instance.assigned_question_ids),
      );
      const grade = gradeByStudent.get(instance.student_id) ?? null;
      return {
        id: instance.id,
        name: student?.name ?? null,
        application_number: student?.application_number ?? "unknown",
        score,
        grade,
        stale: grade ? isGradeStale(grade.final_grade, score) : false,
      };
    })
    .sort((a, b) => a.application_number.localeCompare(b.application_number));

  return (
    <main className="space-y-8">
      {examError || !exam ? (
        <h1 className="text-2xl"><T id="shell.copy.examNotFound" /></h1>
      ) : (
        <>
          <header className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <Link href="/admin/exams" className="hover:underline"><T id="shell.group.exams" /></Link>
            </p>
            <h1 className="text-2xl">{exam.name}</h1>
            <p className="text-sm text-muted-foreground"><T id="shell.copy.grades" /></p>
          </header>

          {instancesError ? (
            <p className="text-sm text-destructive">
              Failed to load submitted exams.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students have submitted this exam yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b py-3 pr-4"><T id="shell.copy.student" /></th>
                  <th className="border-b py-3 pr-4"><T id="schedule.page.application" /></th>
                  <th className="border-b py-3 pr-4"><T id="shell.copy.score" /></th>
                  <th className="border-b py-3"><T id="shell.copy.grade" /></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b py-3 pr-4">
                      <Link href={`/admin/review/${row.id}`} className="hover:underline">
                        {row.name?.trim() || row.application_number}
                      </Link>
                    </td>
                    <td className="border-b py-3 pr-4">
                      {row.application_number}
                    </td>
                    <td className="border-b py-3 pr-4">
                      {row.score.correct}/{row.score.total} correct
                      {row.score.pendingReview > 0
                        ? ` · ${row.score.pendingReview} to review`
                        : ""}
                    </td>
                    <td className="border-b py-3">
                      <div className="flex flex-wrap gap-2">
                        {row.grade ? (
                          <Badge>Finalized {Number(row.grade.final_grade)}%</Badge>
                        ) : (
                          <Badge variant="secondary"><T id="schedule.page.notFinalized" /></Badge>
                        )}
                        {row.stale ? (
                          <Badge variant="destructive"><T id="schedule.page.changedSince" /></Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
