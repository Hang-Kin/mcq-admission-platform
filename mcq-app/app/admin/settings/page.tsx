import { createClient } from "@/lib/supabase/server";

import { SettingsForm, type SubjectSettingValues } from "./SettingsForm";
import {
  countRealTopics,
  DEFAULT_MINUTES,
  DEFAULT_QUESTIONS_PER_TOPIC,
  isMissingSchema,
  SUBJECTS,
} from "./subjectSettings";

export const instant = false;

export default async function SubjectSettingsPage() {
  const supabase = await createClient();
  const [settingsResult, questionsResult] = await Promise.all([
    supabase
      .from("subject_settings")
      .select("subject, questions_per_category, duration_minutes"),
    supabase.from("questions").select("subject, category").in("subject", [...SUBJECTS]),
  ]);

  const missing =
    isMissingSchema(settingsResult.error) || isMissingSchema(questionsResult.error);
  const loadFailed =
    (Boolean(settingsResult.error) || Boolean(questionsResult.error)) && !missing;

  const settingsBySubject = new Map(
    (settingsResult.data ?? []).map((row) => [String(row.subject), row]),
  );
  const categoriesBySubject = new Map<string, Array<string | null>>();
  for (const row of questionsResult.data ?? []) {
    const subject = String(row.subject ?? "");
    const list = categoriesBySubject.get(subject) ?? [];
    list.push(row.category);
    categoriesBySubject.set(subject, list);
  }

  const subjects: SubjectSettingValues[] = SUBJECTS.map((id) => {
    const stored = settingsBySubject.get(id);
    const questionsPerTopic = Number(stored?.questions_per_category);
    const minutes = Number(stored?.duration_minutes);
    return {
      id,
      title: id,
      topicCount: countRealTopics(categoriesBySubject.get(id) ?? []),
      questionsPerTopic:
        Number.isInteger(questionsPerTopic) && questionsPerTopic > 0
          ? questionsPerTopic
          : DEFAULT_QUESTIONS_PER_TOPIC,
      minutes: Number.isInteger(minutes) && minutes > 0 ? minutes : DEFAULT_MINUTES[id],
    };
  });

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl">Subject settings</h1>
        <p className="text-sm text-muted-foreground">
          Choose how many questions come from each topic, and how many minutes
          students get.
        </p>
      </div>
      {missing ? (
        <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          Subject settings are waiting for a database update. You can leave this
          page until that update is applied.
        </p>
      ) : loadFailed ? (
        <p className="text-sm text-destructive">Could not load subject settings.</p>
      ) : (
        <SettingsForm subjects={subjects} />
      )}
    </main>
  );
}
