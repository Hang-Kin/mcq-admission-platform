import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

import { isGradeStale, scoreResponses } from "../../gradeScore";

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

  const { data: instanceRows, error: instancesError } = await supabase
    .from("test_instances")
    .select(
      `
      id,
      student_id,
      submitted_at,
      students!inner ( name, application_number ),
      responses ( is_correct, needs_review )
    `,
    )
    .eq("exam_id", examId)
    .eq("status", "submitted");

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
      const score = scoreResponses(instance.responses ?? []);
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
    <main className="p-8">
      {examError || !exam ? (
        <h1 className="text-2xl font-bold">Exam not found</h1>
      ) : (
        <>
          <header className="mb-8">
            <p className="mb-2 text-sm">
              <Link href="/admin/exams" className="underline">
                Exams
              </Link>
            </p>
            <h1 className="text-2xl font-bold">{exam.name}</h1>
            <p className="text-muted-foreground">Grades</p>
          </header>

          {instancesError ? (
            <p>Failed to load submitted exams.</p>
          ) : rows.length === 0 ? (
            <p>No students have submitted this exam yet.</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="border-b py-2 pr-4">Student</th>
                  <th className="border-b py-2 pr-4">Application number</th>
                  <th className="border-b py-2 pr-4">Score</th>
                  <th className="border-b py-2">Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b py-2 pr-4">
                      <Link
                        href={`/admin/exams/${exam.id}/grades/${row.id}`}
                        className="underline"
                      >
                        {row.name?.trim() || row.application_number}
                      </Link>
                    </td>
                    <td className="border-b py-2 pr-4">
                      {row.application_number}
                    </td>
                    <td className="border-b py-2 pr-4">
                      {row.score.correct}/{row.score.total} correct
                      {row.score.pendingReview > 0
                        ? ` · ${row.score.pendingReview} to review`
                        : ""}
                    </td>
                    <td className="border-b py-2">
                      <div className="flex flex-wrap gap-2">
                        {row.grade ? (
                          <Badge>Finalized {Number(row.grade.final_grade)}%</Badge>
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
          )}
        </>
      )}
    </main>
  );
}
