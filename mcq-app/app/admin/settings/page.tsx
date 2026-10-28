import { SettingsBody } from "./SettingsBody";

export const instant = false;

export default function SubjectSettingsPage() {
  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl">Subject settings</h1>
        <p className="text-sm text-muted-foreground">
          Choose how many questions come from each topic, and how many minutes
          students get.
        </p>
      </div>
      <SettingsBody />
    </main>
  );
}
