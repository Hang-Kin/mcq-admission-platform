import { T, TText } from "@/app/admin/T";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { labels } from "../schedule/labels";

export const instant = false;

export default async function ExamsPage() {
  const supabase = await createClient();
  const { data: exams, error } = await supabase
    .from("exams")
    .select("id, name, duration_minutes, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl"><T id="shell.group.exams" /></h1>
          <p className="text-sm text-muted-foreground">
            <TText text={labels.examListIntro} />
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/exams/new"><T id="shell.copy.newExam" /></Link>
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive"><T id="shell.copy.failedExams" /></p>
      ) : !exams || exams.length === 0 ? (
        <p className="text-sm text-muted-foreground"><T id="shell.copy.noExams" /></p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="border-b py-3 pr-4"><T id="shell.copy.exam" /></th>
                <th className="border-b py-3 pr-4"><T id="shell.copy.duration" /></th>
                <th className="border-b py-3 pr-4"><T id="shell.copy.created" /></th>
                <th className="border-b py-3 pr-4"><T id="shell.item.checklistCodes" /></th>
                <th className="border-b py-3 pr-4"><TText text={labels.sittingsColumn} /></th>
                <th className="border-b py-3 pr-4"><T id="shell.copy.sections" /></th>
                <th className="border-b py-3"><T id="shell.copy.grades" /></th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td className="border-b py-3 pr-4 text-foreground">
                    {exam.name}
                  </td>
                  <td className="border-b py-3 pr-4">
                    {exam.duration_minutes} min
                  </td>
                  <td className="border-b py-3 pr-4">
                    {exam.created_at
                      ? new Date(exam.created_at).toLocaleString()
                      : ""}
                  </td>
                  <td className="border-b py-3 pr-4">
                    <Link
                      href={`/admin/exams/${exam.id}/qr`}
                      className="hover:underline"
                    >
                      Generate QR
                    </Link>
                  </td>
                  <td className="border-b py-3 pr-4">
                    <Link
                      href={`/admin/schedule?exam=${exam.id}`}
                      className="hover:underline"
                    >
                      <TText text={labels.openSittings} />
                    </Link>
                  </td>
                  <td className="border-b py-3 pr-4">
                    <Link
                      href={`/admin/exams/${exam.id}/sections`}
                      className="hover:underline"
                    ><T id="shell.copy.sections" /></Link>
                  </td>
                  <td className="border-b py-3">
                    <Link
                      href={`/admin/exams/${exam.id}/grades`}
                      className="hover:underline"
                    ><T id="shell.copy.grades" /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
