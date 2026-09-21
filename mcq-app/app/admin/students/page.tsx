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
    <main className="p-8">
      <h1 className="text-2xl font-bold">Students</h1>
      <p className="mt-2 text-muted-foreground">
        Add one student at a time. The form stays on this page so you can keep
        entering names until the commissioner roster is available.
      </p>

      <StudentForm action={createStudent} />

      <h2 className="mt-10 text-xl font-semibold">Roster</h2>
      {error ? (
        <p className="mt-4">Failed to load students.</p>
      ) : !students || students.length === 0 ? (
        <p className="mt-4">No students yet</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b py-2 pr-4">Name</th>
              <th className="border-b py-2 pr-4">Application number</th>
              <th className="border-b py-2">Added</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td className="border-b py-2 pr-4">{student.name ?? ""}</td>
                <td className="border-b py-2 pr-4">
                  {student.application_number}
                </td>
                <td className="border-b py-2">
                  {student.created_at
                    ? new Date(student.created_at).toLocaleString()
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
