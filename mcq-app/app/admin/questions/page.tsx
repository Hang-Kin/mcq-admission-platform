import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const instant = false;

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export default async function AdminQuestionsPage() {
  const supabase = await createClient();
  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, question_text, category, type, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Questions</h1>
        <Link href="/admin/questions/new" className="underline">
          New question
        </Link>
      </div>

      {error ? (
        <p className="mt-4">Failed to load questions.</p>
      ) : !questions || questions.length === 0 ? (
        <p className="mt-4">No questions yet</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b py-2 pr-4">Question</th>
              <th className="border-b py-2 pr-4">Category</th>
              <th className="border-b py-2 pr-4">Type</th>
              <th className="border-b py-2 pr-4">Created</th>
              <th className="border-b py-2">Edit</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((question) => (
              <tr key={question.id}>
                <td className="border-b py-2 pr-4">
                  {truncate(question.question_text, 60)}
                </td>
                <td className="border-b py-2 pr-4">{question.category}</td>
                <td className="border-b py-2 pr-4">{question.type}</td>
                <td className="border-b py-2 pr-4">
                  {question.created_at
                    ? new Date(question.created_at).toLocaleString()
                    : ""}
                </td>
                <td className="border-b py-2">
                  <Link
                    href={`/admin/questions/${question.id}/edit`}
                    className="underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
