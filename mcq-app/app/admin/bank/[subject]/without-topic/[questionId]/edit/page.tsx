import { notFound, redirect } from "next/navigation";

import { deleteBankQuestion, updateBankQuestion } from "../../../../actions";
import { BankQuestionForm } from "../../../../BankQuestionForm";
import { BankTrail } from "../../../../BankTrail";
import { DeleteBankQuestionButton } from "../../../../DeleteBankQuestionButton";
import { loadQuestion } from "../../../../loadBank";
import {
  isRealTopic,
  parseSubject,
  subjectById,
  topicHref,
} from "../../../../subjects";

export const instant = false;

export default async function EditUnfiledQuestionPage({
  params,
}: {
  params: Promise<{ subject: string; questionId: string }>;
}) {
  const { subject: subjectParam, questionId } = await params;
  const subject = parseSubject(subjectParam);
  if (!subject) notFound();

  const loaded = await loadQuestion(questionId);
  const question = loaded.question;
  if (!question || question.subject !== subject) notFound();

  if (isRealTopic(question.category)) {
    redirect(topicHref(subject, question.category!.trim()) + `/${question.id}/edit`);
  }

  const info = subjectById(subject);
  const returnTo = `/admin/bank/${subject}/without-topic`;

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <BankTrail
          items={[
            { href: "/admin/bank", label: "Questions" },
            { href: `/admin/bank/${subject}`, label: info.title },
            { href: returnTo, label: "No topic yet" },
            { label: "Edit" },
          ]}
        />
        <h1 className="text-2xl">Edit question</h1>
      </div>
      <BankQuestionForm
        subject={subject}
        topic=""
        filing
        question={question}
        action={updateBankQuestion}
      />
      <DeleteBankQuestionButton id={question.id} returnTo={returnTo} action={deleteBankQuestion} />
    </main>
  );
}
