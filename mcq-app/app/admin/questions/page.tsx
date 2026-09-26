import Link from "next/link";

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
    <main className="p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Questions</h1>
        <div className="flex items-center gap-4">
          <Link href="/admin/questions/import" className="underline">
            Import CSV
          </Link>
          <Link href={newQuestionHref} className="underline">
            New question
          </Link>
        </div>
      </div>

      {error ? (
        <p className="mt-4">
          Failed to load questions.
          {error.message.includes("image_url")
            ? " Apply migration 012 before using image questions."
            : ""}
        </p>
      ) : (
        <>
          <h2 className="mt-8 text-lg font-semibold">Question sets</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A set is every question that shares the same question_set tag.
          </p>
          {summaries.length === 0 ? (
            <p className="mt-4">No questions yet</p>
          ) : (
            <table className="mt-4 w-full max-w-xl border-collapse text-left">
              <thead>
                <tr>
                  <th className="border-b py-2 pr-4">Set</th>
                  <th className="border-b py-2 pr-4">Questions</th>
                  <th className="border-b py-2">View</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => {
                  const selected =
                    (summary.name === null && filteringUnset) ||
                    (summary.name !== null && summary.name === activeSet);
                  return (
                    <tr key={summary.name ?? "__none__"}>
                      <td className="border-b py-2 pr-4">
                        {summary.name ?? "No set"}
                      </td>
                      <td className="border-b py-2 pr-4">{summary.count}</td>
                      <td className="border-b py-2">
                        {selected ? (
                          <Link href="/admin/questions" className="underline">
                            Show all
                          </Link>
                        ) : (
                          <Link href={setHref(summary.name)} className="underline">
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <h2 className="mt-8 text-lg font-semibold">
            {filteringUnset
              ? "No set"
              : activeSet
                ? activeSet
                : "All questions"}
          </h2>
          {visible.length === 0 ? (
            <p className="mt-4">No questions in this view</p>
          ) : (
            <table className="mt-4 w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="border-b py-2 pr-4">Question</th>
                  <th className="border-b py-2 pr-4">Set</th>
                  <th className="border-b py-2 pr-4">Category</th>
                  <th className="border-b py-2 pr-4">Type</th>
                  <th className="border-b py-2 pr-4">Image</th>
                  <th className="border-b py-2 pr-4">Created</th>
                  <th className="border-b py-2">Edit</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((question) => (
                  <tr key={question.id}>
                    <td className="border-b py-2 pr-4">
                      {truncate(question.question_text, 60)}
                    </td>
                    <td className="border-b py-2 pr-4">
                      {question.question_set?.trim() || "No set"}
                    </td>
                    <td className="border-b py-2 pr-4">{question.category}</td>
                    <td className="border-b py-2 pr-4">{question.type}</td>
                    <td className="border-b py-2 pr-4">
                      {question.image_url ? "Yes" : ""}
                    </td>
                    <td className="border-b py-2 pr-4">
                      {question.created_at
                        ? new Date(question.created_at).toLocaleString()
                        : ""}
                    </td>
                    <td className="border-b py-2">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/questions/${question.id}/edit`}
                          className="underline"
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
          )}
        </>
      )}
    </main>
  );
}
