import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { SettingsBody } from "../settings/SettingsBody";
import { WaitingNote } from "./BankTrail";
import { QuestionTabs } from "./QuestionTabs";
import { isMissingSchema } from "./schemaError";
import { SUBJECTS } from "./subjects";

export const instant = false;

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const settings = tab === "settings";

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl">Questions</h1>
        <QuestionTabs settings={settings} />
      </div>
      {settings ? <SettingsTab /> : <QuestionsTab />}
    </main>
  );
}

async function QuestionsTab() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select("subject")
    .in("subject", ["Math", "Chinese"]);

  const missing = isMissingSchema(error);
  const counts = new Map<string, number>();
  if (!error) {
    for (const row of data ?? []) {
      const subject = String(row.subject ?? "");
      counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }
  }

  return (
    <>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Choose Math or Chinese, then open a topic to add questions.
      </p>
      {missing ? <WaitingNote /> : null}
      {error && !missing ? (
        <p className="text-sm text-destructive">Could not load the question bank.</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {SUBJECTS.map((subject) => {
          const count = counts.get(subject.id);
          return (
            <Link
              key={subject.id}
              href={`/admin/bank/${subject.id}`}
              className="block rounded-lg text-foreground hover:no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Card className="h-full min-h-44 hover:border-primary">
                <CardHeader className="gap-3 p-8">
                  <CardTitle className="text-3xl">{subject.title}</CardTitle>
                  <CardDescription className="text-base leading-7">
                    {subject.description}
                  </CardDescription>
                  {count != null ? (
                    <p className="text-sm text-muted-foreground">
                      {count === 1 ? "1 question" : `${count} questions`}
                    </p>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function SettingsTab() {
  return (
    <>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Choose how many questions come from each topic, and how many minutes
        students get.
      </p>
      <SettingsBody />
    </>
  );
}
