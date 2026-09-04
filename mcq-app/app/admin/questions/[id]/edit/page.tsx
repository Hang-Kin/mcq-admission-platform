import { updateQuestion } from "../../actions";
import { QuestionForm } from "../../QuestionForm";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: question, error } = await supabase
    .from("questions")
    .select("id, question_text, category, type, options, correct_answer")
    .eq("id", id)
    .single();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Edit question</h1>
      {error || !question ? (
        <p className="mt-4">Question not found.</p>
      ) : (
        <QuestionForm
          question={question}
          action={updateQuestion.bind(null, question.id)}
        />
      )}
    </main>
  );
}
