import { T } from "@/app/admin/T";
import Link from "next/link";
import { redirect } from "next/navigation";

import { connection } from "next/server";

import { isHiddenAdminRoute } from "../../hiddenRoutes";
import { createExam } from "../actions";
import { ExamForm } from "../ExamForm";

export const instant = false;

export default async function NewExamPage() {
  if (isHiddenAdminRoute("/admin/exams/new")) redirect("/admin");
  await connection();

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="text-sm">
          <Link href="/admin/exams" className="hover:underline"><T id="shell.group.exams" /></Link>
        </p>
        <h1 className="text-2xl"><T id="shell.copy.newExam" /></h1>
        <p className="text-sm text-muted-foreground">
          <T id="shell.copy.examReady" />
        </p>
      </div>
      <ExamForm action={createExam} />
    </main>
  );
}
