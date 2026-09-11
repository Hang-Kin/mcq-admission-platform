import { createClient } from "@/lib/supabase/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ReviewActions } from "./ReviewActions";

export const instant = false;

type Nested<T> = T | T[] | null | undefined;

function asSingle<T>(value: Nested<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function ReviewQueuePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("responses")
    .select(
      `
      id,
      student_answer,
      is_correct,
      needs_review,
      created_at,
      test_instances!inner (
        students!inner ( name, application_number ),
        exams!inner ( name )
      ),
      questions!inner ( question_text )
    `,
    )
    .eq("needs_review", true)
    .order("created_at", { ascending: true });

  const rows = (data ?? []).map((row) => {
    const instance = asSingle(row.test_instances);
    const student = asSingle(instance?.students);
    const exam = asSingle(instance?.exams);
    const question = asSingle(row.questions);
    return {
      id: row.id,
      student_answer: row.student_answer,
      is_correct: row.is_correct,
      created_at: row.created_at,
      student_name: student?.name ?? null,
      application_number: student?.application_number ?? "unknown",
      exam_name: exam?.name ?? "Unknown exam",
      question_text: question?.question_text ?? "Unknown question",
    };
  });

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Review queue</h1>
      <p className="mt-2 text-muted-foreground">
        Text answers waiting for a human to mark correct or incorrect.
      </p>

      {error ? (
        <p className="mt-6">Failed to load responses waiting for review.</p>
      ) : rows.length === 0 ? (
        <p className="mt-6">No responses waiting for review</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    {row.student_name?.trim() || row.application_number}
                  </CardTitle>
                  <CardDescription>
                    {row.application_number} · {row.exam_name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="leading-relaxed">{row.question_text}</p>
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-base">
                    {row.student_answer?.trim()
                      ? row.student_answer
                      : "(empty answer)"}
                  </p>
                  {row.is_correct === null ? (
                    <p className="text-sm text-muted-foreground">
                      Auto-grade did not record a yes/no result.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Auto-grade guess: {row.is_correct ? "correct" : "incorrect"}
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                  <ReviewActions responseId={row.id} />
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
