export type GeneratePickerInput = {
  studentIds: string[];
  questionSetNames: string[];
  questionCount: number;
  availableQuestionCount: number;
};

export type GeneratePickerResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateGeneratePicker(
  input: GeneratePickerInput,
): GeneratePickerResult {
  if (input.studentIds.length === 0) {
    return { ok: false, error: "Select at least one student." };
  }

  if (input.questionSetNames.length === 0) {
    return { ok: false, error: "Select at least one question set." };
  }

  if (!Number.isInteger(input.questionCount) || input.questionCount <= 0) {
    return { ok: false, error: "Question count must be a whole number greater than 0." };
  }

  if (input.questionCount > input.availableQuestionCount) {
    return {
      ok: false,
      error: `Only ${input.availableQuestionCount} question${input.availableQuestionCount === 1 ? "" : "s"} available in the selected set(s).`,
    };
  }

  return { ok: true };
}

export const API_ERROR_COPY: Record<string, string> = {
  invalid_json: "The request could not be read. Try again.",
  missing_exam_id: "This exam is missing. Go back and pick an exam.",
  no_students_selected: "Select at least one student.",
  no_question_sets_selected: "Select at least one question set.",
  invalid_question_count: "Question count must be a whole number greater than 0.",
  not_authenticated: "You are not signed in. Refresh and log in again.",
  exam_not_found: "This exam was not found.",
  not_enough_questions_in_selected_sets:
    "There are not enough questions in the selected set(s).",
  question_fetch_failed: "Could not load questions. Try again.",
};
