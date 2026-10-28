import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { BankTrail, WaitingNote } from "../../BankTrail";
import { loadSubjectBank } from "../../loadBank";
import { QuestionList } from "../../QuestionList";
import {
  decodeTopicParam,
  isRealTopic,
  parseSubject,
  subjectById,
  topicHref,
  validateTopicName,
} from "../../subjects";
import { topicCountText } from "../../topicOrder";

export const instant = false;

export default async function TopicQuestionsPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>;
}) {
  const { subject: subjectParam, topic: topicParam } = await params;
  const subject = parseSubject(subjectParam);
  const topic = validateTopicName(decodeTopicParam(topicParam));
  if (!subject || !topic.ok) notFound();

  const bank = await loadSubjectBank(subject);
  const questions = bank.questions.filter(
    (question) => question.category?.trim() === topic.name,
  );
  const short = questions.length < bank.perTopic;
  const info = subjectById(subject);
  const listHref = topicHref(subject, topic.name);

  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <BankTrail
            items={[
              { href: "/admin/bank", label: "Question bank" },
              { href: `/admin/bank/${subject}`, label: info.title },
              { label: topic.name },
            ]}
          />
          <h1 className="text-2xl">{topic.name}</h1>
          <p className="text-sm text-muted-foreground">
            {topicCountText(questions.length, bank.perTopic)}
          </p>
          {short && !bank.missing && !bank.loadFailed ? (
            <Badge variant="destructive">Needs more questions</Badge>
          ) : null}
        </div>
        <Button asChild className="h-12 px-5 text-base">
          <Link href={`${listHref}/new`}>Add question</Link>
        </Button>
      </div>

      {bank.missing ? <WaitingNote /> : null}
      {bank.loadFailed ? (
        <p className="text-sm text-destructive">Could not load questions.</p>
      ) : null}
      {!bank.missing && !bank.loadFailed ? (
        <QuestionList
          questions={questions.filter((question) => isRealTopic(question.category))}
          returnTo={listHref}
          editHref={(id) => `${listHref}/${id}/edit`}
        />
      ) : null}
    </main>
  );
}
