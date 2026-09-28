import { connection } from "next/server";

import { ImportForm } from "../ImportForm";

export const instant = false;

export default async function ImportQuestionsPage() {
  await connection();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Import questions</h1>
      <ImportForm />
    </main>
  );
}
