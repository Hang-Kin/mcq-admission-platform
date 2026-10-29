import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { isMissingSchema } from "@/app/admin/students/schemaError";

import { QrGeneratorClient } from "../../QrGeneratorClient";
import {
  normalizeInstanceStatus,
  type QrStudent,
  type QuestionSetOption,
} from "../../qrTypes";

export const instant = false;

export default async function ExamQrPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, name, duration_minutes")
    .eq("id", examId)
    .single();

  const { data: studentRows, error: studentError } = await supabase
    .from("students")
    .select("id, name, application_number, intake")
    .order("intake", { ascending: false })
    .order("application_number", { ascending: true });
  const intakeMissing = isMissingSchema(studentError);

  const { data: instanceRows } = await supabase
    .from("test_instances")
    .select("student_id, status")
    .eq("exam_id", examId);

  const { count: sectionCount, error: sectionError } = await supabase
    .from("exam_sections")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);

  const usesSections = !sectionError && (sectionCount ?? 0) > 0;

  const { data: questionRows } = usesSections
    ? { data: [] }
    : await supabase.from("questions").select("question_set");

  const statusByStudent = new Map<string, string>();
  for (const instance of instanceRows ?? []) {
    statusByStudent.set(instance.student_id, instance.status);
  }

  const students: QrStudent[] = (studentRows ?? []).map((student) => ({
    id: student.id,
    name: student.name,
    application_number: student.application_number,
    intake: typeof student.intake === "string" ? student.intake : null,
    instanceStatus: normalizeInstanceStatus(statusByStudent.get(student.id)),
  }));

  const counts = new Map<string, number>();
  for (const question of questionRows ?? []) {
    const name = question.question_set?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const questionSets: QuestionSetOption[] = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, count }));

  return (
    <main className="space-y-8">
      {examError || !exam ? (
        <h1 className="text-2xl">Exam not found</h1>
      ) : (
        <>
          <header className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <Link href="/admin/exams" className="hover:underline">
                Exams
              </Link>
              {" · "}
              <Link href={`/admin/exams/${exam.id}/timeslots`} className="hover:underline">
                Timeslots
              </Link>
            </p>
            <h1 className="text-2xl">{exam.name}</h1>
            <p className="text-sm text-muted-foreground">
              {exam.duration_minutes} minute{exam.duration_minutes === 1 ? "" : "s"}
            </p>
          </header>
          {intakeMissing ? (
            <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
              QR codes are waiting for a database update. You can leave this
              page until that update is applied.
            </p>
          ) : studentError ? (
            <p className="text-sm text-destructive">Could not load the students.</p>
          ) : (
            <QrGeneratorClient
              examId={exam.id}
              students={students}
              questionSets={questionSets}
              usesSections={usesSections}
            />
          )}
        </>
      )}
    </main>
  );
}
