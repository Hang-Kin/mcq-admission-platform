import { createClient } from "@/lib/supabase/server";

import { createStudent } from "./actions";
import { StudentForm } from "./StudentForm";

export const instant = false;

export default async function AdminStudentsPage() {
  const supabase = await createClient();
  const { data: students, error } = await supabase
    .from("students")
    .select("id, name, application_number, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
      <h1 className="text-2xl">Students</h1>
      <p className="text-sm text-muted-foreground">
        Add one student at a time. The form stays on this page so you can keep
        entering names until the commissioner roster is available.
      </p>
      </div>

      <StudentForm action={createStudent} />

      <h2 className="text-lg">Roster</h2>
      {error ? (
        <p className="text-sm text-destructive">Failed to load students.</p>
      ) : !students || students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students yet</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b py-3 pr-4">Name</th>
              <th className="border-b py-3 pr-4">Application number</th>
              <th className="border-b py-3">Added</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td className="border-b py-3 pr-4">{student.name ?? ""}</td>
                <td className="border-b py-3 pr-4">
                  {student.application_number}
                </td>
                <td className="border-b py-3">
                  {student.created_at
                    ? new Date(student.created_at).toLocaleString()
                    : ""}
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
