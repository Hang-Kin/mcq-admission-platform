import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import {
  createSection,
  deleteSection,
  moveSection,
  renumberSections,
  updateSection,
} from "./actions";
import {
  earliestSectionPlan,
  sectionDurationView,
  subjectMinutesFromRows,
} from "../../../settings/sectionMinutes";
import { labels } from "../../../schedule/labels";
import {
  frozenMinutesMessage,
  subjectSettingsMessage,
} from "../../../schedule/sittingRules";
import { SectionAdminClient, type SectionRow } from "./SectionAdminClient";

export const instant = false;

export default async function ExamSectionsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
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

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, name")
    .eq("id", examId)
    .single();

  const { data: sectionRows, error: sectionError } = await supabase
    .from("exam_sections")
    .select("id, label, question_set, duration_minutes, position, subject")
    .eq("exam_id", examId)
    .order("position", { ascending: true });

  const [settingsResult, startedResult] = await Promise.all([
    supabase.from("subject_settings").select("subject, duration_minutes"),
    supabase
      .from("test_instances")
      .select("started_at, section_plan")
      .eq("exam_id", examId)
      .not("started_at", "is", null)
      .order("started_at", { ascending: true })
      .limit(1),
  ]);
  const started = !startedResult.error && (startedResult.data?.length ?? 0) > 0;
  const startedUnknown = Boolean(startedResult.error);
  const settings = settingsResult.error
    ? null
    : subjectMinutesFromRows(
        (settingsResult.data ?? []).map((row) => ({
          subject: row.subject == null ? null : String(row.subject),
          durationMinutes: Number(row.duration_minutes),
        })),
      );
  const plan = earliestSectionPlan(
    (startedResult.data ?? []).map((row) => ({
      startedAt: row.started_at == null ? null : String(row.started_at),
      plan: row.section_plan,
    })),
  );

  const { data: questionRows } = await supabase
    .from("questions")
    .select("question_set");

  const questionSetNames = [
    ...new Set(
      (questionRows ?? [])
        .map((row) => row.question_set?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const sections: SectionRow[] = (sectionRows ?? []).map((row) => {
    const view = sectionDurationView({
      subject: row.subject == null ? null : String(row.subject),
      position: Number(row.position),
      storedMinutes: Number(row.duration_minutes),
      settings,
      started: started || startedUnknown,
      plan,
    });
    return {
      id: row.id,
      label: row.label,
      question_set: row.question_set,
      subject: row.subject == null ? null : String(row.subject),
      duration_minutes: view.minutes,
      position: row.position,
      duration_locked: view.locked || startedUnknown,
      duration_note: null,
    };
  });
  const minutesMessage = started
    ? frozenMinutesMessage(sections.map((section) => section.duration_minutes))
    : subjectSettingsMessage(settings);

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
              <Link href={`/admin/exams/${exam.id}/qr`} className="hover:underline">
                QR codes
              </Link>
            </p>
            <h1 className="text-2xl">{exam.name}</h1>
            <p className="text-sm text-muted-foreground">Sections</p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {startedUnknown
                ? "These minutes cannot be changed until we know whether a student has started."
                : minutesMessage}{" "}
              <Link href="/admin/bank?tab=settings" className="hover:underline">
                {labels.subjectSettingsLink}
              </Link>
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">{labels.sectionsIntro}</p>
            {startedUnknown ? (
              <p className="text-sm text-destructive">
                Could not check whether a student has started, so the minutes cannot be changed.
              </p>
            ) : null}
            {!started && !startedUnknown && settingsResult.error ? (
              <p className="text-sm text-destructive">
                Could not load Subject settings, so the saved section minutes are shown.
              </p>
            ) : null}
          </header>
          <SectionAdminClient
            examId={exam.id}
            sections={sections}
            questionSetNames={questionSetNames}
            canDelete={profile?.role === "admin"}
            loadError={
              sectionError
                ? "Could not load sections for this exam."
                : null
            }
            createSection={createSection}
            updateSection={updateSection}
            deleteSection={deleteSection}
            moveSection={moveSection}
            renumberSections={renumberSections}
          />
        </>
      )}
    </main>
  );
}
