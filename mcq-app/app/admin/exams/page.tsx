import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ExamsPage() {
  const supabase = await createClient();
  const { data: exams, error } = await supabase
    .from("exams")
    .select("id, name, duration_minutes, schedule_time")
    .order("created_at", { ascending: false });

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Exams</h1>
      {error ? (
        <p className="mt-4">Failed to load exams.</p>
      ) : !exams || exams.length === 0 ? (
        <p className="mt-4">No exams yet</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b py-2 pr-4">Exam</th>
              <th className="border-b py-2 pr-4">Duration</th>
              <th className="border-b py-2">QR codes</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr key={exam.id}>
                <td className="border-b py-2 pr-4">{exam.name}</td>
                <td className="border-b py-2 pr-4">
                  {exam.duration_minutes} min
                </td>
                <td className="border-b py-2">
                  <Link href={`/admin/exams/${exam.id}/qr`} className="underline">
                    Generate QR
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
