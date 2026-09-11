import { createClient } from "@/lib/supabase/server";

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

  const { data: studentRows } = await supabase
    .from("students")
    .select("id, name, application_number")
    .order("application_number", { ascending: true });

  const { data: instanceRows } = await supabase
    .from("test_instances")
    .select("student_id, status")
    .eq("exam_id", examId);

  const { data: questionRows } = await supabase
    .from("questions")
    .select("question_set");

  const statusByStudent = new Map<string, string>();
  for (const instance of instanceRows ?? []) {
    statusByStudent.set(instance.student_id, instance.status);
  }

  const students: QrStudent[] = (studentRows ?? []).map((student) => ({
    id: student.id,
    name: student.name,
    application_number: student.application_number,
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
    <main className="p-8">
      {examError || !exam ? (
        <h1 className="text-2xl font-bold">Exam not found</h1>
      ) : (
        <>
          <header className="mb-8">
            <h1 className="text-2xl font-bold">{exam.name}</h1>
            <p className="text-muted-foreground">
              {exam.duration_minutes} minute{exam.duration_minutes === 1 ? "" : "s"}
            </p>
          </header>
          <QrGeneratorClient
            examId={exam.id}
            students={students}
            questionSets={questionSets}
          />
        </>
      )}
    </main>
  );
}
