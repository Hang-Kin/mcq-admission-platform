import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { createQuestion } from "../actions";
import { QuestionForm } from "../QuestionForm";
import { questionSetNames } from "../questionSets";

export const instant = false;

export default async function NewQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const { set } = await searchParams;
  const supabase = await createClient();
  const { data: rows } = await supabase.from("questions").select("question_set");

  return (
    <main className="p-8">
      <p className="mb-2 text-sm">
        <Link href="/admin/questions" className="underline">
          Questions
        </Link>
      </p>
      <h1 className="text-2xl font-bold">New question</h1>
      <QuestionForm
        action={createQuestion}
        questionSetNames={questionSetNames((rows ?? []).map((row) => row.question_set))}
        initialQuestionSet={set?.trim() ?? ""}
      />
    </main>
  );
}
