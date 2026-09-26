export const MAX_OPTIONS = 6;
export const MAX_IMPORT_ROWS = 500;
export const QUESTION_TYPES = ["radio", "numeric", "text"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export type QuestionPayload = {
  question_text: string;
  category: string;
  type: QuestionType;
  options: string[] | null;
  correct_answer: string | null;
  question_set: string | null;
};

export type QuestionRowInput = {
  question_text: string;
  category: string;
  type: string;
  options: string[] | null;
  correct_answer: string | null;
  question_set?: string | null;
  requireQuestionSet?: boolean;
};

export type QuestionValidationResult =
  | { ok: true; payload: QuestionPayload }
  | { ok: false; error: string };

export function isQuestionType(value: string): value is QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(value);
}

function resolveQuestionSet(
  input: QuestionRowInput,
): { ok: true; question_set: string | null } | { ok: false; error: string } {
  const raw = input.question_set;
  const question_set = raw == null ? "" : String(raw).trim();

  if (input.requireQuestionSet) {
    if (!question_set) {
      return { ok: false, error: "Please assign a question set." };
    }
    return { ok: true, question_set };
  }

  return { ok: true, question_set: question_set || null };
}

export function validateQuestionRow(
  input: QuestionRowInput,
): QuestionValidationResult {
  const question_text = input.question_text.trim();
  const category = input.category.trim();
  const type = input.type.trim();
  const correct_answer = (input.correct_answer ?? "").trim();
  const setResult = resolveQuestionSet(input);

  if (!setResult.ok) return setResult;

  if (!question_text || !category || !type) {
    return { ok: false, error: "Please fill in all required fields." };
  }

  if (!isQuestionType(type)) {
    return { ok: false, error: 'type must be exactly "radio", "numeric", or "text"' };
  }

  if (type === "radio") {
    const options = (input.options ?? [])
      .map((option) => option.trim())
      .filter(Boolean);

    if (options.length < 2) {
      return { ok: false, error: "Please provide at least two options." };
    }

    if (options.length > MAX_OPTIONS) {
      return {
        ok: false,
        error: `radio questions can have at most ${MAX_OPTIONS} options`,
      };
    }

    if (!correct_answer) {
      return { ok: false, error: "Please select a correct option." };
    }

    if (!options.includes(correct_answer)) {
      return { ok: false, error: "correct_answer does not match any option" };
    }

    return {
      ok: true,
      payload: {
        question_text,
        category,
        type,
        options,
        correct_answer,
        question_set: setResult.question_set,
      },
    };
  }

  const leftoverOptions = (input.options ?? [])
    .map((option) => option.trim())
    .filter(Boolean);

  if (leftoverOptions.length > 0) {
    return {
      ok: false,
      error: "options must be empty for numeric and text questions",
    };
  }

  if (type === "numeric" && !correct_answer) {
    return { ok: false, error: "Please provide a correct answer." };
  }

  return {
    ok: true,
    payload: {
      question_text,
      category,
      type,
      options: null,
      correct_answer: correct_answer || null,
      question_set: setResult.question_set,
    },
  };
}
