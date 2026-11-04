import { T } from "@/app/admin/T";
import Link from "next/link";

import { ImportRosterForm } from "../ImportRosterForm";

export const instant = false;

export default function ImportStudentsPage() {
  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/admin/students" className="hover:underline"><T id="shell.nav.students" /></Link>
        </p>
        <h1 className="text-2xl"><T id="shell.copy.import" /></h1>
        <p className="text-sm text-muted-foreground"><T id="students.page.importIntro" /></p>
      </div>
      <ImportRosterForm />
    </main>
  );
}
