import { T } from "@/app/admin/T";
import { notFound } from "next/navigation";

import { BankTrail, WaitingNote } from "../../BankTrail";
import { loadSubjectBank } from "../../loadBank";
import { QuestionList } from "../../QuestionList";
import { isRealTopic, parseSubject, subjectById } from "../../subjects";

export const instant = false;

export default async function UnfiledQuestionsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject: subjectParam } = await params;
  const subject = parseSubject(subjectParam);
  if (!subject) notFound();

  const bank = await loadSubjectBank(subject);
  const questions = bank.questions.filter((question) => !isRealTopic(question.category));
  const info = subjectById(subject);
  const returnTo = `/admin/bank/${subject}/without-topic`;

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <BankTrail
          items={[
            { href: "/admin/bank", label: "Questions" },
            { href: `/admin/bank/${subject}`, label: info.title },
            { label: "No topic yet" },
          ]}
        />
        <h1 className="text-2xl"><T id="shell.copy.noTopicYet" /></h1>
        <p className="text-sm text-muted-foreground"><T id="shell.copy.olderHelp" /></p>
      </div>
      {bank.missing ? <WaitingNote /> : null}
      {bank.loadFailed ? (
        <p className="text-sm text-destructive"><T id="shell.copy.couldNotLoadQuestions" /></p>
      ) : null}
      {!bank.missing && !bank.loadFailed ? (
        <QuestionList
          questions={questions}
          returnTo={returnTo}
          emptyLabel="No older questions are waiting for a topic."
          editHref={(id) => `${returnTo}/${id}/edit`}
        />
      ) : null}
    </main>
  );
}
