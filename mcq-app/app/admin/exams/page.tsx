import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

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
          <h1 className="text-2xl">Exams</h1>
          <p className="text-sm text-muted-foreground">
            Open an exam for QR codes, timeslots, sections, and grades.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/exams/new">New exam</Link>
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive">Failed to load exams.</p>
      ) : !exams || exams.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exams yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="border-b py-3 pr-4">Exam</th>
                <th className="border-b py-3 pr-4">Duration</th>
                <th className="border-b py-3 pr-4">Created</th>
                <th className="border-b py-3 pr-4">QR codes</th>
                <th className="border-b py-3 pr-4">Timeslots</th>
                <th className="border-b py-3 pr-4">Sections</th>
                <th className="border-b py-3">Grades</th>
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
                      href={`/admin/exams/${exam.id}/timeslots`}
                      className="hover:underline"
                    >
                      Timeslots
                    </Link>
                  </td>
                  <td className="border-b py-3 pr-4">
                    <Link
                      href={`/admin/exams/${exam.id}/sections`}
                      className="hover:underline"
                    >
                      Sections
                    </Link>
                  </td>
                  <td className="border-b py-3">
                    <Link
                      href={`/admin/exams/${exam.id}/grades`}
                      className="hover:underline"
                    >
                      Grades
                    </Link>
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
