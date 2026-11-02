import Link from "next/link";

import { labels, markWord } from "@/app/admin/results/labels";
import { UUID_RE } from "@/app/admin/results/ids";
import { loadRegrade } from "@/app/admin/results/loadRegrade";
import { requireStaff } from "@/app/admin/results/staffGate";

import { RegradePanel } from "../RegradePanel";

export const instant = false;

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function answerText(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || labels.noCorrectAnswer;
}

export default async function RegradeQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { questionId } = await params;
  const query = await searchParams;
  const staff = await requireStaff();
  if (!staff.ok) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl">{labels.regradeTitle}</h1>
        <p className="text-sm text-muted-foreground">{staff.error}</p>
      </main>
    );
  }

  if (!UUID_RE.test(questionId)) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl">{labels.regradeTitle}</h1>
        <p className="text-sm text-muted-foreground">{labels.questionNotFound}</p>
      </main>
    );
  }

  const loaded = await loadRegrade(staff.supabase, questionId);
  if (!loaded.ok) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl">{labels.regradeTitle}</h1>
        <p className="text-sm text-destructive">{loaded.error}</p>
      </main>
    );
  }

  const beforeNull = one(query.before_null) === "1";
  const beforeParam = one(query.before);
  const beforeKnown = beforeNull || beforeParam !== undefined;
  const before = beforeParam ?? "";
  const done = one(query.done) === "1";
  const changed = Number(one(query.changed) ?? "");
  const kept = Number(one(query.kept) ?? "");
  const preview = loaded.preview;
  const canApply = loaded.markingReady && preview.changes.length > 0;

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href={`/admin/questions/${questionId}/edit`} className="hover:underline">
            {labels.editQuestion}
          </Link>
          <Link href="/admin/review" className="hover:underline">
            {labels.backToResults}
          </Link>
        </p>
        <h1 className="text-2xl">{labels.regradeTitle}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{loaded.question.text}</p>
      </header>

      {done && Number.isFinite(changed) && Number.isFinite(kept) ? (
        <p className="text-sm">{labels.regradeDone(changed, kept)}</p>
      ) : (
        <p className="max-w-2xl text-sm text-muted-foreground">{labels.regradeNotYet}</p>
      )}

      {!loaded.markingReady ? (
        <p className="text-sm text-muted-foreground">{labels.markingWaiting}</p>
      ) : null}

      <section className="max-w-2xl space-y-2 text-sm">
        {beforeKnown ? (
          <p>
            <span className="font-medium">{labels.previousCorrect}: </span>
            {beforeNull ? labels.noCorrectAnswer : answerText(before)}
          </p>
        ) : null}
        <p>
          <span className="font-medium">{labels.newCorrect}: </span>
          {answerText(loaded.question.correctAnswer)}
        </p>
        <p>{labels.wouldChange(preview.students, preview.changes.length)}</p>
        <p>{labels.preservedOverrides(preview.preservedOverrides)}</p>
      </section>

      {preview.changes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="border-b py-3 pr-4">{labels.student}</th>
                <th className="border-b py-3 pr-4">{labels.answer}</th>
                <th className="border-b py-3 pr-4">{labels.now}</th>
                <th className="border-b py-3">{labels.after}</th>
              </tr>
            </thead>
            <tbody>
              {preview.changes.map((change) => (
                <tr key={change.responseId}>
                  <td className="border-b py-3 pr-4">{change.studentLabel}</td>
                  <td className="whitespace-pre-wrap border-b py-3 pr-4">
                    {change.studentAnswer?.trim() ? change.studentAnswer : labels.emptyAnswer}
                  </td>
                  <td className="border-b py-3 pr-4">{markWord(change.from)}</td>
                  <td className="border-b py-3">{markWord(change.to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <RegradePanel
        questionId={questionId}
        beforeKnown={beforeKnown}
        beforeNull={beforeNull}
        before={before}
        canApply={canApply}
      />
    </main>
  );
}
