import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { deleteQuestion, updateQuestion } from "../../actions";
import { DeleteQuestionButton } from "../../DeleteQuestionButton";
import { QuestionForm } from "../../QuestionForm";
import { questionSetNames } from "../../questionSets";

export const instant = false;

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const { data: question, error } = await supabase
    .from("questions")
    .select(
      "id, question_text, category, type, options, correct_answer, question_set, image_url",
    )
    .eq("id", id)
    .single();

  const { data: rows } = await supabase.from("questions").select("question_set");

  return (
    <main className="p-8">
      <p className="mb-2 text-sm">
        <Link href="/admin/questions" className="underline">
          Questions
        </Link>
      </p>
      <h1 className="text-2xl font-bold">Edit question</h1>
      {error || !question ? (
        <p className="mt-4">Question not found.</p>
      ) : (
        <>
          <QuestionForm
            question={question}
            action={updateQuestion.bind(null, question.id)}
            questionSetNames={questionSetNames(
              (rows ?? []).map((row) => row.question_set),
            )}
          />
          {profile?.role === "admin" ? (
            <div className="mt-8">
              <DeleteQuestionButton id={question.id} action={deleteQuestion} />
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
