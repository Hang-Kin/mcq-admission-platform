import { SettingsForm } from "./SettingsForm";
import { loadSubjectSettings } from "./loadSubjectSettings";

export async function SettingsBody() {
  const loaded = await loadSubjectSettings();

  if (loaded.missing) {
    return (
      <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
        Subject settings are waiting for a database update. You can leave this
        page until that update is applied.
      </p>
    );
  }
  if (loaded.loadFailed) {
    return <p className="text-sm text-destructive">Could not load subject settings.</p>;
  }
  return <SettingsForm subjects={loaded.subjects} />;
}
