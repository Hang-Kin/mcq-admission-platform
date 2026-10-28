import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { QrGeneratorClient } from "../exams/QrGeneratorClient";
import { normalizeInstanceStatus, type QrStudent } from "../exams/qrTypes";
import { isStartInNext24Hours, nextExamId } from "../homeChecklist";
import { DrawPreview } from "./DrawPreview";
import { SittingCard } from "./SittingCard";
import { AddSubjectsForm, AddTimeForm, CreateExamForm } from "./SittingsForms";
import {
  groupDrawPreview,
  isMissingSchema,
  sittingStatus,
  unpreparedStartWarning,
  type DrawRow,
  type TopicOrder,
} from "./scheduleModel";
import { hasMathAndChinese, prepareTargetId, sittingsFocus } from "./sittingsFlow";

export const instant = false;

type SlotRow = {
  id: string;
  label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  exam_id: string | null;
};

type DrawRecord = {
  timeslot_id: string;
  subject: string | null;
  question_id: string;
  position: number | null;
};

type ExamRow = {
  id: string;
  name: string | null;
  created_at: string | null;
};

type SectionRow = {
  exam_id: string;
  subject: string | null;
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string; new?: string }>;
}) {
  const { exam: examParam, new: newExam } = await searchParams;
  const nowMs = Date.now();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    slotsResult,
    examsResult,
    drawsResult,
    startedResult,
    ordersResult,
    sectionsResult,
    studentsResult,
    instancesResult,
    profileResult,
  ] = await Promise.all([
    supabase
      .from("timeslots")
      .select("id, label, starts_at, ends_at, exam_id")
      .order("starts_at", { ascending: true }),
    supabase.from("exams").select("id, name, created_at").order("created_at", { ascending: false }),
    supabase.from("timeslot_draws").select("timeslot_id, subject, question_id, position"),
    supabase.from("test_instances").select("timeslot_id").not("started_at", "is", null),
    supabase.from("subject_topics").select("subject, category, display_order"),
    supabase.from("exam_sections").select("exam_id, subject"),
    supabase.from("students").select("id, name, application_number").order("application_number", { ascending: true }),
    supabase.from("test_instances").select("exam_id, student_id, status, access_token"),
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const slots = (slotsResult.data ?? []) as SlotRow[];
  const exams = (examsResult.data ?? []) as ExamRow[];
  const draws = drawsResult.error ? [] : ((drawsResult.data ?? []) as DrawRecord[]);
  const lockedIds = new Set(
    (startedResult.error ? [] : (startedResult.data ?? []))
      .map((row) => row.timeslot_id)
      .filter((id): id is string => Boolean(id)),
  );
  const orders: TopicOrder[] = ordersResult.error
    ? []
    : (ordersResult.data ?? []).map((row) => ({
        subject: String(row.subject),
        category: String(row.category),
        displayOrder: Number(row.display_order),
      }));
  const sections = sectionsResult.error ? [] : ((sectionsResult.data ?? []) as SectionRow[]);
  const subjectColumnMissing = isMissingSchema(sectionsResult.error);
  const drawsMissing = isMissingSchema(drawsResult.error);
  const schemaReady = !drawsMissing && !subjectColumnMissing;
  const canDelete = profileResult.data?.role === "admin";

  const questionIds = [...new Set(draws.map((draw) => draw.question_id))];
  const questionsResult =
    questionIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("questions").select("id, question_text, category").in("id", questionIds);
  const questions = new Map(
    (questionsResult.data ?? []).map((question) => [
      String(question.id),
      {
        text: String(question.question_text ?? ""),
        category: String(question.category ?? "").trim(),
      },
    ]),
  );

  const sittingViews = slots.map((slot) => {
    const prepared = draws.some((draw) => draw.timeslot_id === slot.id);
    const locked = lockedIds.has(slot.id);
    return {
      id: slot.id,
      label: slot.label?.trim() || "Sitting",
      startsAt: slot.starts_at,
      examId: slot.exam_id,
      status: sittingStatus(prepared, locked),
    };
  });
  const targetId = prepareTargetId(sittingViews, nowMs, isStartInNext24Hours);
  const target = sittingViews.find((sitting) => sitting.id === targetId) ?? null;
  const nextId = nextExamId(
    slots.map((slot) => ({ examId: slot.exam_id, endsAt: slot.ends_at })),
    exams.map((exam) => ({ id: String(exam.id), createdAt: exam.created_at })),
    nowMs,
  );
  const knownIds = new Set(exams.map((exam) => String(exam.id)));
  const selectedId =
    (examParam && knownIds.has(examParam) && examParam) ||
    (target?.examId && knownIds.has(String(target.examId)) && String(target.examId)) ||
    (nextId && knownIds.has(nextId) && nextId) ||
    (exams[0] ? String(exams[0].id) : null);
  const selected = exams.find((exam) => String(exam.id) === selectedId) ?? null;
  const selectedSubjects = sections
    .filter((section) => String(section.exam_id) === selectedId)
    .map((section) => section.subject);
  const selectedHasSubjects = hasMathAndChinese(selectedSubjects);
  const selectedSlots = slots.filter((slot) => String(slot.exam_id ?? "") === selectedId);
  const prepareHere = Boolean(target && String(target.examId ?? "") === selectedId);

  const students = studentsResult.data ?? [];
  const studentIds = new Set(students.map((student) => String(student.id)));
  const instances = instancesResult.error ? [] : (instancesResult.data ?? []);
  const examInstances = instances.filter(
    (row) => selectedId != null && String(row.exam_id) === selectedId && studentIds.has(String(row.student_id ?? "")),
  );
  const statusByStudent = new Map<string, string>();
  for (const row of examInstances) {
    statusByStudent.set(String(row.student_id), String(row.status ?? ""));
  }
  const qrStudents: QrStudent[] = students.map((student) => ({
    id: String(student.id),
    name: student.name,
    application_number: String(student.application_number),
    instanceStatus: normalizeInstanceStatus(statusByStudent.get(String(student.id))),
  }));
  const existingCodes = examInstances
    .map((row) => ({
      studentId: String(row.student_id ?? ""),
      token: typeof row.access_token === "string" ? row.access_token : "",
    }))
    .filter((row) => row.token.length > 0);

  const focus = sittingsFocus({
    schemaReady,
    examCount: exams.length,
    selectedHasSubjects,
    prepareHere,
    selectedTimeCount: selectedSlots.length,
    studentCount: studentsResult.error ? 0 : students.length,
    codedStudentCount: new Set(existingCodes.map((row) => row.studentId)).size,
  });
  const checkFailed = Boolean(startedResult.error) && !isMissingSchema(startedResult.error);
  const showCreate = exams.length === 0 || newExam === "1";
  const elsewhere = target && String(target.examId ?? "") !== selectedId ? target : null;

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl">Sittings</h1>
        <p className="text-sm text-muted-foreground">
          {selected
            ? `${selected.name?.trim() || "Exam"}. Math, then Chinese. Minutes come from Subject settings.`
            : "Name the exam. Math and Chinese are added for you."}
        </p>
        {exams.length > 1 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
            {exams.map((exam) => {
              const id = String(exam.id);
              const current = id === selectedId;
              return (
                <Link
                  key={id}
                  href={`/admin/schedule?exam=${id}`}
                  aria-current={current ? "page" : undefined}
                  className={
                    current
                      ? "text-sm font-medium text-primary hover:no-underline"
                      : "text-sm text-muted-foreground hover:text-foreground hover:no-underline"
                  }
                >
                  {exam.name?.trim() || "Exam"}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      {drawsMissing || subjectColumnMissing ? (
        <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          Preparing questions is waiting for a database update. You can leave
          this page until that update is applied.
        </p>
      ) : null}
      {slotsResult.error ? (
        <p className="text-sm text-destructive">Could not load the sittings.</p>
      ) : null}
      {drawsResult.error && !drawsMissing ? (
        <p className="text-sm text-destructive">Could not load the prepared questions.</p>
      ) : null}
      {sectionsResult.error && !subjectColumnMissing ? (
        <p className="text-sm text-destructive">Could not check Math and Chinese.</p>
      ) : null}
      {checkFailed ? (
        <p className="text-sm text-destructive">
          Could not check whether a student has started. Refresh before you
          prepare again.
        </p>
      ) : null}
      {elsewhere ? (
        <p className="text-sm text-destructive">
          <Link href={`/admin/schedule?exam=${elsewhere.examId}`} className="hover:underline">
            {elsewhere.label}
          </Link>{" "}
          still needs questions.
        </p>
      ) : null}

      {showCreate ? (
        <CreateExamForm prominent={focus === "create"} />
      ) : (
        <p className="text-sm">
          <Link href={`/admin/schedule?exam=${selectedId ?? ""}&new=1`} className="hover:underline">
            Create another exam
          </Link>
          {" · "}
          <Link href="/admin/exams" className="hover:underline">
            Exam list
          </Link>
        </p>
      )}

      {selected && schemaReady && !selectedHasSubjects ? (
        <AddSubjectsForm examId={String(selected.id)} prominent={focus === "subjects"} />
      ) : null}

      {selected ? (
        <section className="space-y-4">
          <h2 className="text-lg">Times</h2>
          {selectedSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No times yet.</p>
          ) : (
            selectedSlots.map((slot) => {
              const prepared = draws.some((draw) => draw.timeslot_id === slot.id);
              const locked = lockedIds.has(slot.id);
              const status = sittingStatus(prepared, locked);
              const rows: DrawRow[] = draws
                .filter((draw) => draw.timeslot_id === slot.id)
                .map((draw) => {
                  const question = questions.get(draw.question_id);
                  return {
                    subject: String(draw.subject ?? ""),
                    category: question?.category || "Topic",
                    position: Number(draw.position ?? 0),
                    questionText: question?.text || "This question could not be loaded.",
                  };
                });
              return (
                <SittingCard
                  key={slot.id}
                  sittingId={slot.id}
                  examId={String(selected.id)}
                  title={slot.label?.trim() || "Sitting"}
                  examName={selected.name?.trim() || "Exam"}
                  startsAt={slot.starts_at}
                  endsAt={slot.ends_at}
                  status={status}
                  startWarning={unpreparedStartWarning(status, slot.starts_at, nowMs)}
                  unavailable={checkFailed && !locked}
                  prominent={focus === "prepare" && slot.id === targetId}
                  canDelete={canDelete}
                >
                  <DrawPreview groups={groupDrawPreview(rows, orders)} />
                </SittingCard>
              );
            })
          )}
          {schemaReady ? (
            <AddTimeForm examId={String(selected.id)} prominent={focus === "time"} />
          ) : null}
        </section>
      ) : null}

      {selected && selectedHasSubjects ? (
        <section id="codes" className="space-y-4">
          <h2 className="text-lg">QR codes</h2>
          {studentsResult.error || instancesResult.error ? (
            <p className="text-sm text-destructive">Could not load the codes.</p>
          ) : students.length === 0 ? (
            <Button asChild variant={focus === "students" ? "default" : "outline"} className="h-12 px-5 text-base">
              <Link href="/admin/students">Add students</Link>
            </Button>
          ) : (
            <QrGeneratorClient
              examId={String(selected.id)}
              students={qrStudents}
              questionSets={[]}
              usesSections
              plainLanguage
              primaryAction={focus === "codes" ? "create" : focus === "print" ? "print" : "none"}
              existingCodes={existingCodes}
            />
          )}
        </section>
      ) : null}
    </main>
  );
}
