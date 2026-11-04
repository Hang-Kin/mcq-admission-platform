import { T, TText } from "@/app/admin/T";
import Link from "next/link";

import { isMissingSubjectColumn, readQuestionSubject } from "@/components/mathText";
import { createClient } from "@/lib/supabase/server";

import { answeredWarning } from "@/app/admin/results/labels";
import { countStudents } from "@/app/admin/results/regrade";

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

  const withSubject = await supabase
    .from("questions")
    .select(
      "id, question_text, category, type, options, correct_answer, question_set, image_url, subject",
    )
    .eq("id", id)
    .single();
  const loaded =
    withSubject.error && isMissingSubjectColumn(withSubject.error.message)
      ? await supabase
          .from("questions")
          .select(
            "id, question_text, category, type, options, correct_answer, question_set, image_url",
          )
          .eq("id", id)
          .single()
      : withSubject;
  const question = loaded.data
    ? { ...loaded.data, subject: readQuestionSubject(loaded.data) }
    : null;
  const error = loaded.error;

  const { data: rows } = await supabase.from("questions").select("question_set");
  let warning: string | null = null;
  if (question) {
    const answered = await supabase
      .from("responses")
      .select("test_instances!inner(student_id)")
      .eq("question_id", question.id);
    if (!answered.error) {
      const studentIds = (answered.data ?? []).map((row) => {
        const instance = Array.isArray(row.test_instances) ? row.test_instances[0] : row.test_instances;
        return instance?.student_id ?? null;
      });
      warning = answeredWarning(countStudents(studentIds));
    }
  }

  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/admin/questions" className="hover:underline"><T id="shell.nav.questions" /></Link>
        </p>
        <h1 className="text-2xl"><T id="shell.copy.editQuestion" /></h1>
      </div>
      {error || !question ? (
        <p className="text-sm text-destructive"><T id="shell.copy.questionNotFound" /></p>
      ) : (
        <>
          {warning ? <p className="max-w-xl text-sm text-muted-foreground"><TText text={warning} /></p> : null}
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
