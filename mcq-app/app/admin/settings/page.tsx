import { T } from "@/app/admin/T";
import { SettingsBody } from "./SettingsBody";

export const instant = false;

export default function SubjectSettingsPage() {
  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl"><T id="shell.group.subjectSettings" /></h1>
        <p className="text-sm text-muted-foreground"><T id="shell.copy.settingsTabIntro" /></p>
      </div>
      <SettingsBody />
    </main>
  );
}
