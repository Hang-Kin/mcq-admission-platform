import { createClient } from "@/lib/supabase/server";

import { DrawPreview } from "./DrawPreview";
import { SittingCard } from "./SittingCard";
import {
  groupDrawPreview,
  isMissingSchema,
  sittingStatus,
  type DrawRow,
  type TopicOrder,
} from "./scheduleModel";

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

export default async function SchedulePage() {
  const supabase = await createClient();
  const [slotsResult, examsResult, drawsResult, startedResult, ordersResult] = await Promise.all([
    supabase
      .from("timeslots")
      .select("id, label, starts_at, ends_at, exam_id")
      .order("starts_at", { ascending: true }),
    supabase.from("exams").select("id, name"),
    supabase.from("timeslot_draws").select("timeslot_id, subject, question_id, position"),
    supabase.from("test_instances").select("timeslot_id").not("started_at", "is", null),
    supabase.from("subject_topics").select("subject, category, display_order"),
  ]);

  const slots = (slotsResult.data ?? []) as SlotRow[];
  const examNames = new Map(
    (examsResult.data ?? []).map((exam) => [String(exam.id), String(exam.name ?? "Exam")]),
  );
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

  const questionIds = [...new Set(draws.map((draw) => draw.question_id))];
  const questionsResult =
    questionIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("questions")
          .select("id, question_text, category")
          .in("id", questionIds);
  const questions = new Map(
    (questionsResult.data ?? []).map((question) => [
      String(question.id),
      {
        text: String(question.question_text ?? ""),
        category: String(question.category ?? "").trim(),
      },
    ]),
  );

  const missing = isMissingSchema(drawsResult.error);
  const checkFailed = Boolean(startedResult.error) && !isMissingSchema(startedResult.error);

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl">Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Prepare the questions for each sitting. Every student in that sitting
          gets the same questions.
        </p>
      </div>

      {missing ? (
        <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          Preparing questions is waiting for a database update. You can leave
          this page until that update is applied.
        </p>
      ) : null}
      {slotsResult.error ? (
        <p className="text-sm text-destructive">Could not load the schedule.</p>
      ) : null}
      {drawsResult.error && !missing ? (
        <p className="text-sm text-destructive">Could not load the prepared questions.</p>
      ) : null}
      {checkFailed ? (
        <p className="text-sm text-destructive">
          Could not check whether a student has started. Refresh before you
          prepare again.
        </p>
      ) : null}

      {!slotsResult.error && slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sittings yet.</p>
      ) : null}

      <div className="space-y-4">
        {!slotsResult.error
          ? slots.map((slot) => {
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
                  title={slot.label?.trim() || "Sitting"}
                  examName={examNames.get(String(slot.exam_id ?? "")) ?? "Exam"}
                  startsAt={slot.starts_at}
                  endsAt={slot.ends_at}
                  status={status}
                  unavailable={checkFailed && !locked}
                >
                  <DrawPreview groups={groupDrawPreview(rows, orders)} />
                </SittingCard>
              );
            })
          : null}
      </div>
    </main>
  );
}
