import { notFound } from "next/navigation";

import { createBankQuestion } from "../../../actions";
import { BankQuestionForm } from "../../../BankQuestionForm";
import { BankTrail } from "../../../BankTrail";
import {
  decodeTopicParam,
  parseSubject,
  subjectById,
  topicHref,
  validateTopicName,
} from "../../../subjects";

export const instant = false;

export default async function NewBankQuestionPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>;
}) {
  const { subject: subjectParam, topic: topicParam } = await params;
  const subject = parseSubject(subjectParam);
  const topic = validateTopicName(decodeTopicParam(topicParam));
  if (!subject || !topic.ok) notFound();

  const info = subjectById(subject);

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <BankTrail
          items={[
            { href: "/admin/bank", label: "Questions" },
            { href: `/admin/bank/${subject}`, label: info.title },
            { href: topicHref(subject, topic.name), label: topic.name },
            { label: "Add question" },
          ]}
        />
        <h1 className="text-2xl">Add question</h1>
        <p className="text-sm text-muted-foreground">
          The form clears after a question is saved, so you can enter the next one.
        </p>
      </div>
      <BankQuestionForm subject={subject} topic={topic.name} action={createBankQuestion} />
    </main>
  );
}
