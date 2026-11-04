import { T } from "@/app/admin/T";
import { SettingsForm } from "./SettingsForm";
import { loadSubjectSettings } from "./loadSubjectSettings";

export async function SettingsBody() {
  const loaded = await loadSubjectSettings();

  if (loaded.missing) {
    return (
      <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground"><T id="shell.copy.settingsWaiting" /></p>
    );
  }
  if (loaded.loadFailed) {
    return <p className="text-sm text-destructive"><T id="shell.copy.couldNotLoadSettings" /></p>;
  }
  return <SettingsForm subjects={loaded.subjects} />;
}
