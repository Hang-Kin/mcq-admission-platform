import { createClient } from "@/lib/supabase/server";

import { type SubjectSettingValues } from "./SettingsForm";
import {
  countRealTopics,
  DEFAULT_MINUTES,
  DEFAULT_QUESTIONS_PER_TOPIC,
  isMissingSchema,
  SUBJECTS,
} from "./subjectSettings";

export async function loadSubjectSettings(): Promise<
  | { missing: true; loadFailed: false; subjects: SubjectSettingValues[] }
  | { missing: false; loadFailed: true; subjects: SubjectSettingValues[] }
  | { missing: false; loadFailed: false; subjects: SubjectSettingValues[] }
> {
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

  if (missing) return { missing: true, loadFailed: false, subjects };
  if (loadFailed) return { missing: false, loadFailed: true, subjects };
  return { missing: false, loadFailed: false, subjects };
}
