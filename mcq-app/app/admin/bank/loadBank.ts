import { createClient } from "@/lib/supabase/server";

import { isMissingSchema } from "./schemaError";
import {
  questionsPerTopic,
  type SubjectId,
} from "./subjects";
import { type TopicOrderRow } from "./topicOrder";

export type BankQuestionRow = {
  id: string;
  question_text: string;
  category: string | null;
  type: string;
  subject: string | null;
  options: unknown;
  correct_answer: string | null;
  image_url: string | null;
  created_at: string | null;
};

const QUESTION_COLUMNS =
  "id, question_text, category, type, subject, options, correct_answer, image_url, created_at";

export async function loadSubjectBank(subject: SubjectId) {
  const supabase = await createClient();
  const [questionsResult, settingsResult, orderResult] = await Promise.all([
    supabase
      .from("questions")
      .select(QUESTION_COLUMNS)
      .eq("subject", subject)
      .order("created_at", { ascending: true }),
    supabase
      .from("subject_settings")
      .select("questions_per_category")
      .eq("subject", subject)
      .maybeSingle(),
    supabase
      .from("subject_topics")
      .select("category, display_order")
      .eq("subject", subject),
  ]);

  const orders: TopicOrderRow[] = orderResult.error
    ? []
    : (orderResult.data ?? []).map((row) => ({
        category: String(row.category),
        display_order: Number(row.display_order),
      }));

  return {
    missing: isMissingSchema(questionsResult.error),
    loadFailed: Boolean(questionsResult.error) && !isMissingSchema(questionsResult.error),
    questions: (questionsResult.error ? [] : (questionsResult.data ?? [])) as BankQuestionRow[],
    perTopic: questionsPerTopic(settingsResult.data?.questions_per_category),
    orders,
  };
}

export async function loadQuestion(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  return {
    missing: isMissingSchema(error),
    question: (error ? null : data) as BankQuestionRow | null,
  };
}
