import { createClient } from "@/lib/supabase/server";

import { formatAddedAt } from "./addedAt";
import { createStudent } from "./actions";
import { ImportStudentsLink } from "./ImportStudentsLink";
import { IntakeFilterForm } from "./IntakeFilterForm";
import { formatIntakeLabel, INTAKE_RE } from "./intakeLabel";
import { INTAKE_WAITING_READ, isMissingSchema } from "./schemaError";
import { StudentForm } from "./StudentForm";

export const instant = false;

type RosterRow = {
  id: string;
  name: string | null;
  chinese_name?: string | null;
  application_number: string;
  intake: string | null;
  created_at: string | null;
};

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ intake?: string }>;
}) {
  const { intake: intakeParam } = await searchParams;
  const selectedIntake = intakeParam && INTAKE_RE.test(intakeParam) ? intakeParam : "";
  const supabase = await createClient();
  const withIntake = await supabase
    .from("students")
    .select("id, name, chinese_name, application_number, intake, created_at")
    .order("intake", { ascending: false })
    .order("application_number", { ascending: true });

  const intakeReady = !isMissingSchema(withIntake.error);
  const fallback = intakeReady
    ? null
    : await supabase
        .from("students")
        .select("id, name, application_number, created_at")
        .order("created_at", { ascending: false });
  const result = intakeReady ? withIntake : fallback;
  const error = intakeReady ? withIntake.error : (fallback?.error ?? null);
  const students = ((result?.data ?? []) as RosterRow[]).map((student) => ({
    ...student,
    intake: typeof student.intake === "string" ? student.intake : null,
    chinese_name: typeof student.chinese_name === "string" ? student.chinese_name : null,
  }));
  const intakes = [
    ...new Set(
      students.flatMap((student) =>
        student.intake && INTAKE_RE.test(student.intake) ? [student.intake] : [],
      ),
    ),
  ].sort((a, b) => b.localeCompare(a));
  const visible = selectedIntake
    ? students.filter((student) => student.intake === selectedIntake)
    : students;

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl">Students</h1>
        <ImportStudentsLink />
        <p className="text-sm text-muted-foreground">
          Each student is one intake and one 提交編號. The code is four digits
          and can be used again in a later intake. Import a spreadsheet, or add
          one student below.
        </p>
      </div>

      {!intakeReady ? (
        <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {INTAKE_WAITING_READ}
        </p>
      ) : (
        <IntakeFilterForm intakes={intakes} selectedIntake={selectedIntake} />
      )}

      <section className="space-y-2">
        <h2 className="text-lg">Add one student</h2>
        <StudentForm action={createStudent} />
      </section>

      <h2 className="text-lg">Roster</h2>
      {error ? (
        <p className="text-sm text-destructive">Failed to load students.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {selectedIntake ? "No students in this intake." : "No students yet"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {intakeReady ? <th className="border-b py-3 pr-4">Intake</th> : null}
                <th className="border-b py-3 pr-4">English Name</th>
                {intakeReady ? <th className="border-b py-3 pr-4">Chinese Name</th> : null}
                <th className="border-b py-3 pr-4">提交編號</th>
                <th className="border-b py-3">Added</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((student) => (
                <tr key={student.id}>
                  {intakeReady ? (
                    <td className="border-b py-3 pr-4">
                      {student.intake ? formatIntakeLabel(student.intake) ?? student.intake : ""}
                    </td>
                  ) : null}
                  <td className="border-b py-3 pr-4">{student.name ?? ""}</td>
                  {intakeReady ? (
                    <td className="border-b py-3 pr-4">{student.chinese_name ?? ""}</td>
                  ) : null}
                  <td className="border-b py-3 pr-4">{student.application_number}</td>
                  <td className="border-b py-3">
                    {student.created_at ? formatAddedAt(student.created_at) : ""}
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
