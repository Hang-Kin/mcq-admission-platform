export type SessionQuestion = {
  id: string;
  question_text: string;
  type: string;
  options: unknown;
  category: string;
  // From the start_session payload. A blank subject still uses the legacy
  // Math/math category inside MathText. question_text stays as stored.
  subject?: string | null;
  question_set: string;
  image_url?: string | null;
};

export function isLastQuestion(index: number, total: number) {
  return total > 0 && index === total - 1;
}

export function isBlankAnswer(value: string | undefined) {
  return value === undefined || value.trim() === "";
}

export function unansweredCount(
  questions: readonly { id: string }[],
  answers: Readonly<Record<string, string>>,
) {
  let count = 0;
  for (const question of questions) {
    if (isBlankAnswer(answers[question.id])) count += 1;
  }
  return count;
}

export function canFinishSection(
  index: number,
  total: number,
  hasSection: boolean,
) {
  return hasSection && isLastQuestion(index, total);
}

export function canSubmitExam(
  index: number,
  total: number,
  hasSection: boolean,
) {
  return !hasSection && isLastQuestion(index, total);
}
