// Student exam copy. Keep every user-facing string in this file.

export const FRACTION_BLANK_MESSAGE = "Enter a whole number in both boxes.";
export const FRACTION_INTEGER_MESSAGE = "Use whole numbers only.";
export const FRACTION_DENOMINATOR_MESSAGE =
  "The denominator must be greater than 0.";

export const SECTION_LOCKED_MESSAGE =
  "This section is already finished, so that answer was not saved.";

export const ADVANCE_FAILED_MESSAGE =
  "The section could not be finished. Check your connection and try again.";

export const FINISH_SECTION_CONFIRM =
  "You cannot return to this section. Finish now?";

export const FINISH_SUBMITS_EXAM = "This submits the exam.";

export const SUBMIT_EXAM_CONFIRM =
  "You cannot change your answers after submitting. Submit now?";

/** @type {const} */
export const examLabels = {
  opening: "Opening your exam…",
  submittedTitle: "Exam submitted",
  submittedBody: "Your answers have been recorded. You can close this page.",
  noQuestionsTitle: "No questions assigned",
  noQuestionsBody: "This exam has no questions for you. Ask a teacher for help.",
  timerPlaceholder: "--:--",
  timeRemaining: "Time remaining",
  saving: "Saving…",
  saved: "Saved",
  saveFailed: "Couldn’t save — try again",
  previous: "Previous",
  next: "Next",
  questions: "Questions",
  chooseAnswer: "Choose an answer",
  numericAnswer: "Numeric answer",
  textAnswer: "Your answer",
  fractionLegend: "Fraction answer",
  fractionNumerator: "a (numerator)",
  fractionDenominator: "b (denominator)",
  fractionBlank: FRACTION_BLANK_MESSAGE,
  fractionInteger: FRACTION_INTEGER_MESSAGE,
  fractionDenominatorError: FRACTION_DENOMINATOR_MESSAGE,
  finishTitle: "Finish this section?",
  finishBody: FINISH_SECTION_CONFIRM,
  finishNow: "Finish now",
  finishing: "Finishing…",
  finishSubmitsExam: FINISH_SUBMITS_EXAM,
  submitExam: "Submit exam",
  submitTitle: "Submit this exam?",
  submitBody: SUBMIT_EXAM_CONFIRM,
  submitNow: "Submit now",
  submitting: "Submitting…",
  cancel: "Cancel",
  sectionLocked: SECTION_LOCKED_MESSAGE,
  advanceFailed: ADVANCE_FAILED_MESSAGE,
  oneUnanswered: "1 question is not answered",
  errors: {
    invalid_token: {
      title: "This link is invalid",
      body: "The exam link you used is not recognised. Check the QR code or ask a teacher for a new link.",
    },
    expired: {
      title: "This exam has expired",
      body: "The time allowed for this exam has ended. You can no longer start or continue it.",
    },
    already_submitted: {
      title: "This exam has already been submitted",
      body: "Your answers have already been recorded. You cannot open this exam again.",
    },
    session_already_active: {
      title: "This exam is already open on another device",
      body: "This sitting is locked to the device that opened it first. Close that session, or ask a teacher if you need to switch devices.",
    },
    not_in_progress: {
      title: "This exam is no longer in progress",
      body: "The sitting is not active, so answers cannot be saved. Refresh only if a teacher asks you to.",
    },
    question_not_assigned: {
      title: "This question is not part of your exam",
      body: "The question you tried to answer is not in your assigned set. The exam has been stopped.",
    },
    invalid_session_id: {
      title: "This session is no longer valid",
      body: "The exam sitting on this device does not match the server. Ask a teacher before trying again.",
    },
    invalid_sections: {
      title: "This exam isn’t ready",
      body: "The sections for this exam are not in a continuous order. Ask a teacher to fix them before you start.",
    },
    not_prepared: {
      title: "This sitting is not ready yet. Please ask a teacher.",
      body: "",
    },
    unknown: {
      title: "Something went wrong",
      body: "The exam could not continue. Ask a teacher for help.",
    },
  },
};

/**
 * @param {string} label
 */
export function finishSectionButtonLabel(label) {
  return `Finish ${label}`;
}

export function finishSectionConfirmCopy() {
  return FINISH_SECTION_CONFIRM;
}

/**
 * @param {number} current
 * @param {number} total
 */
export function questionProgressLabel(current, total) {
  return `Question ${current} of ${total}`;
}

/**
 * @param {number} number
 * @param {boolean} answered
 */
export function questionJumpLabel(number, answered) {
  if (answered) return `Question ${number}, answered`;
  return `Question ${number}, not answered`;
}

/**
 * @param {number} count
 * @returns {string | null}
 */
export function unansweredCountLabel(count) {
  if (!Number.isInteger(count) || count <= 0) return null;
  if (count === 1) return examLabels.oneUnanswered;
  return `${count} questions are not answered`;
}

/**
 * @param {"idle" | "saving" | "saved" | "error"} state
 */
export function autosaveStatusLabel(state) {
  if (state === "saving") return examLabels.saving;
  if (state === "saved") return examLabels.saved;
  if (state === "error") return examLabels.saveFailed;
  return "";
}
