import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import {
  createTimeslot,
  deleteTimeslot,
  setTimeslotOverride,
  updateTimeslot,
} from "./actions";
import { TimeslotAdminClient } from "./TimeslotAdminClient";

export const instant = false;

export default async function ExamTimeslotsPage({
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
    .select("id, name, active_timeslot_override")
    .eq("id", examId)
    .single();

  const { data: timeslotRows } = await supabase
    .from("timeslots")
    .select("id, label, question_set, starts_at, ends_at")
    .eq("exam_id", examId)
    .order("starts_at", { ascending: true });

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
            <p className="text-muted-foreground">Timeslots</p>
          </header>
          <TimeslotAdminClient
            examId={exam.id}
            examName={exam.name}
            timeslots={timeslotRows ?? []}
            questionSetNames={questionSetNames}
            activeTimeslotOverride={exam.active_timeslot_override}
            canDelete={profile?.role === "admin"}
            createTimeslot={createTimeslot}
            updateTimeslot={updateTimeslot}
            deleteTimeslot={deleteTimeslot}
            setTimeslotOverride={setTimeslotOverride}
          />
        </>
      )}
    </main>
  );
}
