import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import {
  createSection,
  deleteSection,
  moveSection,
  updateSection,
} from "./actions";
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
    .select("id, label, question_set, duration_minutes, position")
    .eq("exam_id", examId)
    .order("position", { ascending: true });

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

  const sections: SectionRow[] = (sectionRows ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    question_set: row.question_set,
    duration_minutes: Number(row.duration_minutes),
    position: row.position,
  }));

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
              {" · "}
              <Link href={`/admin/exams/${exam.id}/qr`} className="underline">
                QR codes
              </Link>
            </p>
            <h1 className="text-2xl font-bold">{exam.name}</h1>
            <p className="text-muted-foreground">Sections</p>
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
          />
        </>
      )}
    </main>
  );
}
