import Link from "next/link";

import { connection } from "next/server";

import { createExam } from "../actions";
import { ExamForm } from "../ExamForm";

export const instant = false;

export default async function NewExamPage() {
  await connection();

  return (
    <main className="p-8">
      <p className="mb-2 text-sm">
        <Link href="/admin/exams" className="underline">
          Exams
        </Link>
      </p>
      <h1 className="text-2xl font-bold">New exam</h1>
      <p className="mt-2 text-muted-foreground">
        The exam is available as soon as you create it. Next you can add
        sections and timeslots.
      </p>
      <ExamForm action={createExam} />
    </main>
  );
}
