import { createQuestion } from "../actions";
import { QuestionForm } from "../QuestionForm";

export const instant = false;

export default function NewQuestionPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">New question</h1>
      <QuestionForm action={createQuestion} />
    </main>
  );
}
