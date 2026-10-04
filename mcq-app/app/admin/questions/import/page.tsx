import Link from "next/link";
import { connection } from "next/server";

import { ImportForm } from "../ImportForm";

export const instant = false;

export default async function ImportQuestionsPage() {
  await connection();

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="text-sm">
          <Link href="/admin/questions" className="hover:underline">
            Questions
          </Link>
        </p>
        <h1 className="text-2xl">Import questions</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV. Rows are checked before anything is saved.
        </p>
      </div>
      <ImportForm />
    </main>
  );
}
