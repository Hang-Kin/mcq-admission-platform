import { notFound } from "next/navigation";

import { deleteBankQuestion, updateBankQuestion } from "../../../../actions";
import { BankQuestionForm } from "../../../../BankQuestionForm";
import { BankTrail } from "../../../../BankTrail";
import { DeleteBankQuestionButton } from "../../../../DeleteBankQuestionButton";
import { loadQuestion } from "../../../../loadBank";
import {
  decodeTopicParam,
  parseSubject,
  subjectById,
  topicHref,
  validateTopicName,
} from "../../../../subjects";

export const instant = false;

export default async function EditBankQuestionPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string; questionId: string }>;
}) {
  const { subject: subjectParam, topic: topicParam, questionId } = await params;
  const subject = parseSubject(subjectParam);
  const topic = validateTopicName(decodeTopicParam(topicParam));
  if (!subject || !topic.ok) notFound();

  const loaded = await loadQuestion(questionId);
  const question = loaded.question;
  if (
    !question ||
    question.subject !== subject ||
    question.category?.trim() !== topic.name
  ) {
    notFound();
  }

  const info = subjectById(subject);
  const listHref = topicHref(subject, topic.name);

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <BankTrail
          items={[
            { href: "/admin/bank", label: "Questions" },
            { href: `/admin/bank/${subject}`, label: info.title },
            { href: listHref, label: topic.name },
            { label: "Edit" },
          ]}
        />
        <h1 className="text-2xl">Edit question</h1>
      </div>
      <BankQuestionForm
        subject={subject}
        topic={topic.name}
        question={question}
        action={updateBankQuestion}
      />
      <DeleteBankQuestionButton
        id={question.id}
        returnTo={listHref}
        action={deleteBankQuestion}
      />
    </main>
  );
}
