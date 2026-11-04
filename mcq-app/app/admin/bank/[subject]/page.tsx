import { T, TText } from "@/app/admin/T";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { AddTopicForm } from "../AddTopicForm";
import { BankTrail, WaitingNote } from "../BankTrail";
import { loadSubjectBank } from "../loadBank";
import { parseSubject, subjectById, topicHref } from "../subjects";
import { summarizeTopics, topicCountText, unfiledCount } from "../topicOrder";

export const instant = false;

export default async function SubjectTopicsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject: subjectParam } = await params;
  const subject = parseSubject(subjectParam);
  if (!subject) notFound();

  const bank = await loadSubjectBank(subject);
  const info = subjectById(subject);
  const topics = summarizeTopics(
    bank.questions.map((question) => question.category),
    bank.orders,
    bank.perTopic,
  );
  const unfiled = unfiledCount(bank.questions.map((question) => question.category));

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <BankTrail
          items={[
            { href: "/admin/bank", label: "Questions" },
            { label: info.title },
          ]}
        />
        <h1 className="text-2xl"><TText text={info.title} /></h1>
        <p className="text-sm text-muted-foreground">
          Each topic should have at least {bank.perTopic} questions.
        </p>
      </div>

      {bank.missing ? <WaitingNote /> : null}
      {bank.loadFailed ? (
        <p className="text-sm text-destructive"><T id="shell.copy.couldNotLoadTopics" /></p>
      ) : null}

      <AddTopicForm subject={subject} />

      {!bank.missing && !bank.loadFailed ? (
        <>
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground"><T id="shell.copy.noTopics" /></p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {topics.map((topic) => (
                <Link
                  key={topic.name}
                  href={topicHref(subject, topic.name)}
                  className="block rounded-lg text-foreground hover:no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Card
                    className={
                      topic.short
                        ? "h-full min-h-28 border-destructive hover:border-primary"
                        : "h-full min-h-28 hover:border-primary"
                    }
                  >
                    <CardHeader>
                      <CardTitle className="text-xl">{topic.name}</CardTitle>
                      <CardDescription className="text-base">
                        <TText text={topicCountText(topic.count, bank.perTopic)} />
                      </CardDescription>
                      {topic.short ? (
                        <Badge variant="destructive"><T id="shell.copy.needsMore" /></Badge>
                      ) : null}
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {unfiled > 0 ? (
            <Link
              href={`/admin/bank/${subject}/without-topic`}
              className="block max-w-xl rounded-lg text-foreground hover:no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Card className="border-destructive hover:border-primary">
                <CardHeader>
                  <CardTitle className="text-xl"><T id="shell.copy.noTopicYet" /></CardTitle>
                  <CardDescription className="text-base">
                    {unfiled === 1 ? "1 older question" : `${unfiled} older questions`}{" "}
                    will not be used when a sitting is prepared.
                  </CardDescription>
                  <Badge variant="destructive"><T id="shell.copy.needsATopic" /></Badge>
                </CardHeader>
              </Card>
            </Link>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
