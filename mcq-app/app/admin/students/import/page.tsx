import Link from "next/link";

import { ImportRosterForm } from "../ImportRosterForm";

export const instant = false;

export default function ImportStudentsPage() {
  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/admin/students" className="hover:underline">
            Students
          </Link>
        </p>
        <h1 className="text-2xl">Import</h1>
        <p className="text-sm text-muted-foreground">
          Choose the intake, then upload a .xlsx or .csv file. The file needs
          提交編號 and English Name. Full English name is accepted as well.
          Chinese Name is optional. ID and 參考編號 are ignored. 提交編號 is
          read as text, including leading zeros.
        </p>
      </div>
      <ImportRosterForm />
    </main>
  );
}
