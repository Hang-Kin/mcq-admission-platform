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
    <main className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/admin/questions" className="hover:underline">
            Questions
          </Link>
        </p>
        <h1 className="text-2xl">New question</h1>
      </div>
      <QuestionForm
        action={createQuestion}
        questionSetNames={questionSetNames((rows ?? []).map((row) => row.question_set))}
        initialQuestionSet={set?.trim() ?? ""}
      />
    </main>
  );
}
