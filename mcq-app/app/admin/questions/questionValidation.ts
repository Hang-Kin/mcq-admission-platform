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
};

export type QuestionRowInput = {
  question_text: string;
  category: string;
  type: string;
  options: string[] | null;
  correct_answer: string | null;
};

export type QuestionValidationResult =
  | { ok: true; payload: QuestionPayload }
  | { ok: false; error: string };

export function isQuestionType(value: string): value is QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(value);
}

export function validateQuestionRow(
  input: QuestionRowInput,
): QuestionValidationResult {
  const question_text = input.question_text.trim();
  const category = input.category.trim();
  const type = input.type.trim();
  const correct_answer = (input.correct_answer ?? "").trim();

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

  if (!correct_answer) {
    return { ok: false, error: "Please provide a correct answer." };
  }

  return {
    ok: true,
    payload: {
      question_text,
      category,
      type,
      options: null,
      correct_answer,
    },
  };
}
