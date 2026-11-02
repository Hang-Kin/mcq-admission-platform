import Link from "next/link";

import { Button } from "@/components/ui/button";
import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

import { QrGeneratorClient } from "../exams/QrGeneratorClient";
import { normalizeInstanceStatus, type QrStudent } from "../exams/qrTypes";
import { isStartInNext24Hours, nextExamId } from "../homeChecklist";
import {
  examMinuteTotals,
  shortSlotWarning,
  subjectMinutesFromRows,
} from "../settings/sectionMinutes";
import { labels } from "./labels";
import { SittingCard } from "./SittingCard";
import { SittingQuestions } from "./SittingQuestions";
import { SittingSchedule } from "./SittingSchedule";
import { AddSubjectsForm, CreateExamForm } from "./SittingsForms";
import {
  groupDrawPreview,
  isMissingSchema,
  sittingStatus,
  unpreparedStartWarning,
  type DrawRow,
  type TopicOrder,
} from "./scheduleModel";
import {
  activeSittings,
  archivedSittings,
  existingOverlapWarning,
  sittingControls,
  type SittingWindow,
} from "./sittingRules";
import { hasMathAndChinese, prepareTargetId, sittingsFocus } from "./sittingsFlow";

export const instant = false;

type SlotRow = {
  id: string;
  label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  exam_id: string | null;
  archived_at?: string | null;
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
  position: number | null;
  duration_minutes: number | null;
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string; new?: string; archived?: string }>;
}) {
  const { exam: examParam, new: newExam, archived: archivedParam } = await searchParams;
  const showArchived = archivedParam === "1";
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
    settingsResult,
    plansResult,
  ] = await Promise.all([
    supabase
      .from("timeslots")
      .select("id, label, starts_at, ends_at, exam_id, archived_at")
      .order("starts_at", { ascending: true }),
    supabase.from("exams").select("id, name, created_at").order("created_at", { ascending: false }),
    supabase.from("timeslot_draws").select("timeslot_id, subject, question_id, position"),
    supabase.from("test_instances").select("timeslot_id").not("started_at", "is", null),
    supabase.from("subject_topics").select("subject, category, display_order"),
    supabase.from("exam_sections").select("exam_id, subject, position, duration_minutes"),
    supabase
      .from("students")
      .select("id, name, application_number, intake")
      .order("intake", { ascending: false })
      .order("application_number", { ascending: true }),
    supabase.from("test_instances").select("exam_id, student_id, status, access_token"),
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("subject_settings").select("subject, duration_minutes"),
    supabase
      .from("test_instances")
      .select("exam_id, started_at, section_plan")
      .not("started_at", "is", null),
  ]);

  let resolvedSlots: { data: SlotRow[] | null; error: { code?: string; message?: string } | null } =
    slotsResult;
  let archiveSupported = true;
  if (isMissingSchema(slotsResult.error)) {
    archiveSupported = false;
    const fallback = await supabase
      .from("timeslots")
      .select("id, label, starts_at, ends_at, exam_id")
      .order("starts_at", { ascending: true });
    resolvedSlots = {
      data: (fallback.data ?? null) as SlotRow[] | null,
      error: fallback.error,
    };
  }

  const slots = (resolvedSlots.data ?? []) as SlotRow[];
  const activeSlotRows = slots.filter((slot) => !slot.archived_at);
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
  const startedExamIds = plansResult.error
    ? []
    : [
        ...new Set(
          (plansResult.data ?? [])
            .map((row) => (row.exam_id == null ? "" : String(row.exam_id)))
            .filter((id) => id.length > 0),
        ),
      ];
  const minuteTotals = examMinuteTotals({
    sections: sections.map((row) => ({
      examId: String(row.exam_id),
      subject: row.subject,
      position: Number(row.position ?? 0),
      durationMinutes: Number(row.duration_minutes ?? 0),
    })),
    startedExamIds,
    plans: plansResult.error
      ? []
      : (plansResult.data ?? []).map((row) => ({
          examId: row.exam_id == null ? "" : String(row.exam_id),
          startedAt: row.started_at == null ? null : String(row.started_at),
          plan: row.section_plan,
        })),
    settings: settingsResult.error
      ? null
      : subjectMinutesFromRows(
          (settingsResult.data ?? []).map((row) => ({
            subject: row.subject == null ? null : String(row.subject),
            durationMinutes: Number(row.duration_minutes),
          })),
        ),
  });
  const drawsMissing = isMissingSchema(drawsResult.error);
  const schemaReady = !drawsMissing && !subjectColumnMissing;
  const role = profileResult.data?.role;
  const canDelete = role === "admin";
  const canManage = isStaffRole(role);

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

  const sittingViews = activeSlotRows.map((slot) => {
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
    activeSlotRows.map((slot) => ({ examId: slot.exam_id, endsAt: slot.ends_at })),
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
  const selectedWindows = slots
    .filter((slot) => String(slot.exam_id ?? "") === selectedId)
    .map(toWindow);
  const activeSelected = activeSittings(selectedWindows);
  const archivedSelected = archivedSittings(selectedWindows);
  const selectedSlots = activeSlotRows.filter((slot) => String(slot.exam_id ?? "") === selectedId);
  const prepareHere = Boolean(target && String(target.examId ?? "") === selectedId);

  const intakeMissing = isMissingSchema(studentsResult.error);
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
    intake: typeof student.intake === "string" ? student.intake : null,
    instanceStatus: normalizeInstanceStatus(statusByStudent.get(String(student.id))),
  }));
  const codedStudentIds = new Set(
    examInstances
      .filter((row) => typeof row.access_token === "string" && row.access_token.length > 0)
      .map((row) => String(row.student_id ?? "")),
  );

  const focus = sittingsFocus({
    schemaReady,
    examCount: exams.length,
    selectedHasSubjects,
    prepareHere,
    selectedTimeCount: selectedSlots.length,
    studentCount: studentsResult.error ? 0 : students.length,
    codedStudentCount: codedStudentIds.size,
  });
  const checkFailed = Boolean(startedResult.error) && !isMissingSchema(startedResult.error);
  const showCreate = exams.length === 0 || newExam === "1";
  const elsewhere = target && String(target.examId ?? "") !== selectedId ? target : null;
  const overlapWarning = existingOverlapWarning(selectedWindows);
  const examMinutes = minuteTotals.get(String(selected?.id ?? "")) ?? 0;

  function renderSitting(slot: SittingWindow, archived: boolean) {
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
        examId={String(selected?.id ?? "")}
        title={slot.label}
        examName={selected?.name?.trim() || "Exam"}
        startsAt={slot.startsAt}
        endsAt={slot.endsAt}
        status={status}
        startWarning={unpreparedStartWarning(status, slot.startsAt, nowMs)}
        lengthWarning={shortSlotWarning(slot.startsAt, slot.endsAt, examMinutes)}
        unavailable={checkFailed && !locked}
        prominent={focus === "prepare" && slot.id === targetId}
        canDelete={canDelete}
        archived={archived}
        controls={sittingControls({
          locked: status === "Locked",
          archived,
          isAdmin: canDelete,
          canManage,
          archiveSupported,
        })}
        peers={selectedWindows}
        examMinutes={examMinutes}
      >
        <SittingQuestions groups={groupDrawPreview(rows, orders)} />
      </SittingCard>
    );
  }

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
      {resolvedSlots.error ? (
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg">{labels.timesHeading}</h2>
            {archiveSupported ? (
              <Link
                href={scheduleHref(selectedId, !showArchived)}
                className="text-sm hover:underline"
              >
                {showArchived ? labels.hideArchived : labels.showArchived}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">{labels.archiveUnavailable}</p>
            )}
          </div>
          {settingsResult.error && !isMissingSchema(settingsResult.error) ? (
            <p className="text-sm text-destructive">
              Could not read Subject settings, so the length check uses the saved section minutes.
            </p>
          ) : null}
          {overlapWarning ? (
            <p className="text-sm text-destructive">{overlapWarning}</p>
          ) : null}
          <SittingSchedule
            examId={String(selected.id)}
            examMinutes={examMinutes}
            prominent={focus === "time"}
            canAdd={schemaReady}
            gridSlots={showArchived ? selectedWindows : activeSelected}
            clashSlots={selectedWindows}
            nowMs={nowMs}
          >
            {activeSelected.length === 0 ? (
              <p className="text-sm text-muted-foreground">No times yet.</p>
            ) : (
              activeSelected.map((slot) => renderSitting(slot, false))
            )}
            {showArchived ? (
              <div className="space-y-4">
                <h3 className="text-base">{labels.archivedHeading}</h3>
                {archivedSelected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{labels.noArchived}</p>
                ) : (
                  archivedSelected.map((slot) => renderSitting(slot, true))
                )}
              </div>
            ) : null}
          </SittingSchedule>
        </section>
      ) : null}

      {selected && selectedHasSubjects ? (
        <section id="codes" className="space-y-4">
          <h2 className="text-lg">QR codes</h2>
          {intakeMissing ? (
            <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
              QR codes are waiting for a database update. You can leave this
              page until that update is applied.
            </p>
          ) : studentsResult.error || instancesResult.error ? (
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
            />
          )}
        </section>
      ) : null}
    </main>
  );
}

function toWindow(slot: SlotRow): SittingWindow {
  return {
    id: slot.id,
    label: slot.label?.trim() || "Sitting",
    startsAt: slot.starts_at ?? "",
    endsAt: slot.ends_at ?? "",
    archivedAt: slot.archived_at ? String(slot.archived_at) : null,
  };
}

function scheduleHref(examId: string | null, archived: boolean): string {
  const params = new URLSearchParams();
  if (examId) params.set("exam", examId);
  if (archived) params.set("archived", "1");
  const query = params.toString();
  return query ? `/admin/schedule?${query}` : "/admin/schedule";
}
