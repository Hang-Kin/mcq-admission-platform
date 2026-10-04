import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { deleteQuestion } from "./actions";
import { DeleteQuestionButton } from "./DeleteQuestionButton";
import { summarizeQuestionSets } from "./questionSets";

export const instant = false;

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function setHref(name: string | null) {
  if (!name) return "/admin/questions?unset=1";
  return `/admin/questions?set=${encodeURIComponent(name)}`;
}

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; unset?: string }>;
}) {
  const { set: setFilter, unset } = await searchParams;
  const filteringUnset = unset === "1";
  const filteringNamed = !filteringUnset && Boolean(setFilter?.trim());
  const activeSet = filteringNamed ? setFilter!.trim() : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, question_text, category, type, question_set, image_url, created_at")
    .order("created_at", { ascending: false });

  const summaries = summarizeQuestionSets(
    (questions ?? []).map((question) => question.question_set),
  );
  const visible = (questions ?? []).filter((question) => {
    if (filteringUnset) return !question.question_set?.trim();
    if (activeSet) return question.question_set?.trim() === activeSet;
    return true;
  });
  const newQuestionHref = activeSet
    ? `/admin/questions/new?set=${encodeURIComponent(activeSet)}`
    : "/admin/questions/new";

  return (
    <main className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl">Questions</h1>
          <p className="text-sm text-muted-foreground">
            Group questions into sets, then edit or import more.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/questions/import">Import CSV</Link>
          </Button>
          <Button asChild>
            <Link href={newQuestionHref}>New question</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          Failed to load questions.
          {error.message.includes("image_url")
            ? " Apply migration 012 before using image questions."
            : ""}
        </p>
      ) : (
        <>
          <h2 className="text-lg">Question sets</h2>
          <p className="text-sm text-muted-foreground">
            A set is every question that shares the same question_set tag.
          </p>
          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions yet</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full max-w-xl border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b py-3 pr-4">Set</th>
                  <th className="border-b py-3 pr-4">Questions</th>
                  <th className="border-b py-3">View</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => {
                  const selected =
                    (summary.name === null && filteringUnset) ||
                    (summary.name !== null && summary.name === activeSet);
                  return (
                    <tr key={summary.name ?? "__none__"}>
                      <td className="border-b py-3 pr-4">
                        {summary.name ?? "No set"}
                      </td>
                      <td className="border-b py-3 pr-4">{summary.count}</td>
                      <td className="border-b py-3">
                        {selected ? (
                          <Link href="/admin/questions" className="hover:underline">
                            Show all
                          </Link>
                        ) : (
                          <Link href={setHref(summary.name)} className="hover:underline">
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}

          <h2 className="text-lg">
            {filteringUnset
              ? "No set"
              : activeSet
                ? activeSet
                : "All questions"}
          </h2>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions in this view</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b py-3 pr-4">Question</th>
                  <th className="border-b py-3 pr-4">Set</th>
                  <th className="border-b py-3 pr-4">Category</th>
                  <th className="border-b py-3 pr-4">Type</th>
                  <th className="border-b py-3 pr-4">Image</th>
                  <th className="border-b py-3 pr-4">Created</th>
                  <th className="border-b py-3">Edit</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((question) => (
                  <tr key={question.id}>
                    <td className="border-b py-3 pr-4">
                      {truncate(question.question_text, 60)}
                    </td>
                    <td className="border-b py-3 pr-4">
                      {question.question_set?.trim() || "No set"}
                    </td>
                    <td className="border-b py-3 pr-4">{question.category}</td>
                    <td className="border-b py-3 pr-4">{question.type}</td>
                    <td className="border-b py-3 pr-4">
                      {question.image_url ? "Yes" : ""}
                    </td>
                    <td className="border-b py-3 pr-4">
                      {question.created_at
                        ? new Date(question.created_at).toLocaleString()
                        : ""}
                    </td>
                    <td className="border-b py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/questions/${question.id}/edit`}
                          className="hover:underline"
                        >
                          Edit
                        </Link>
                        {isAdmin ? (
                          <DeleteQuestionButton
                            id={question.id}
                            action={deleteQuestion}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
