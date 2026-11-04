import { T } from "@/app/admin/T";
import Link from "next/link";

import { connection } from "next/server";

import { createExam } from "../actions";
import { ExamForm } from "../ExamForm";

export const instant = false;

export default async function NewExamPage() {
  await connection();

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="text-sm">
          <Link href="/admin/exams" className="hover:underline"><T id="shell.group.exams" /></Link>
        </p>
        <h1 className="text-2xl"><T id="shell.copy.newExam" /></h1>
        <p className="text-sm text-muted-foreground">
        The exam is available as soon as you create it. Next you can add
        sections and timeslots.
      </p>
      </div>
      <ExamForm action={createExam} />
    </main>
  );
}
