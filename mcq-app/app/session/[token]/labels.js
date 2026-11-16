// Student exam copy. Keep every user-facing string in this file.
// English is the default. Traditional Chinese is shown only when the
// language setting is zh-Hant (html[data-locale="zh-Hant"]).

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

/** @type {const} */
export const examLabelsZh = {
  opening: "正在開啟考試…",
  submittedTitle: "已交卷",
  submittedBody: "你的答案已經記錄。你可以關閉這個頁面。",
  noQuestionsTitle: "沒有指派題目",
  noQuestionsBody: "這份考試沒有你的題目。請向老師求助。",
  timerPlaceholder: "--:--",
  timeRemaining: "剩餘時間",
  saving: "儲存中…",
  saved: "已儲存",
  saveFailed: "未能儲存，請再試一次",
  previous: "上一題",
  next: "下一題",
  questions: "題目",
  chooseAnswer: "選擇答案",
  numericAnswer: "數字答案",
  textAnswer: "你的答案",
  fractionLegend: "分數答案",
  fractionNumerator: "a（分子）",
  fractionDenominator: "b（分母）",
  fractionBlank: "兩個空格都要填整數。",
  fractionInteger: "只可填整數。",
  fractionDenominatorError: "分母必須大於 0。",
  finishTitle: "完成這個部分？",
  finishBody: "你不能返回這個部分。現在完成？",
  finishNow: "現在完成",
  finishing: "正在完成…",
  finishSubmitsExam: "這會交卷。",
  submitExam: "交卷",
  submitTitle: "交這份卷？",
  submitBody: "交卷後不能更改答案。現在交卷？",
  submitNow: "現在交卷",
  submitting: "正在交卷…",
  cancel: "取消",
  sectionLocked: "這個部分已經完成，所以沒有儲存該答案。",
  advanceFailed: "未能完成這個部分。請檢查連線，然後再試一次。",
  oneUnanswered: "有 1 題未作答",
  errors: {
    invalid_token: {
      title: "這個連結無效",
      body: "系統未能識別這個考試連結。請檢查二維碼，或向老師索取新連結。",
    },
    expired: {
      title: "這份考試已過時",
      body: "這份考試的時限已過。你不能再開始或繼續。",
    },
    already_submitted: {
      title: "這份考試已經交卷",
      body: "你的答案已經記錄。你不能再開啟這份考試。",
    },
    session_already_active: {
      title: "這份考試已在另一部裝置開啟",
      body: "這個場次鎖定在最先開啟它的裝置。請關閉該場次，或如需轉換裝置，請向老師查詢。",
    },
    not_in_progress: {
      title: "這份考試已不在進行中",
      body: "場次未在進行，所以不能儲存答案。只有老師要求時才重新整理。",
    },
    question_not_assigned: {
      title: "這題不屬於你的考試",
      body: "你嘗試作答的題目不在指派範圍內。考試已停止。",
    },
    invalid_session_id: {
      title: "這個場次已失效",
      body: "這部裝置上的考試場次與伺服器不符。請先向老師查詢，然後再試。",
    },
    invalid_sections: {
      title: "這份考試尚未準備好",
      body: "這份考試的部分次序不連續。請老師修正後才開始。",
    },
    not_prepared: {
      title: "這個場次尚未準備好。請向老師查詢。",
      body: "",
    },
    unknown: {
      title: "出現問題",
      body: "考試未能繼續。請向老師求助。",
    },
  },
};

/** @type {Map<string, string>} */
const zhByEnglish = new Map();

/**
 * @param {unknown} english
 * @param {unknown} chinese
 */
function rememberTree(english, chinese) {
  if (typeof english === "string") {
    if (english && typeof chinese === "string" && english !== chinese) {
      zhByEnglish.set(english, chinese);
    }
    return;
  }
  if (!english || typeof english !== "object" || !chinese || typeof chinese !== "object") return;
  for (const key of Object.keys(english)) {
    rememberTree(
      /** @type {Record<string, unknown>} */ (english)[key],
      /** @type {Record<string, unknown>} */ (chinese)[key],
    );
  }
}

rememberTree(examLabels, examLabelsZh);

/**
 * Chinese for a string the exam already built in English. Unknown text stays English.
 * @param {string} text
 */
export function translateExamText(text) {
  if (typeof text !== "string" || !text) return text;
  return zhByEnglish.get(text) ?? text;
}

/**
 * @param {keyof typeof examLabels.errors} code
 */
export function examErrorCopy(code) {
  const english = examLabels.errors[code] ?? examLabels.errors.unknown;
  const chinese = examLabelsZh.errors[code] ?? examLabelsZh.errors.unknown;
  return {
    title: { en: english.title, zh: chinese.title },
    body: { en: english.body, zh: chinese.body },
  };
}

/**
 * @param {string} label
 */
export function finishSectionButtonCopy(label) {
  return { en: `Finish ${label}`, zh: `完成 ${label}` };
}

/**
 * @param {string} label
 */
export function finishSectionButtonLabel(label) {
  return finishSectionButtonCopy(label).en;
}

export function finishSectionConfirmCopy() {
  return FINISH_SECTION_CONFIRM;
}

/**
 * @param {number} current
 * @param {number} total
 */
export function questionProgressCopy(current, total) {
  return {
    en: `Question ${current} of ${total}`,
    zh: `第 ${current} 題，共 ${total} 題`,
  };
}

/**
 * @param {number} current
 * @param {number} total
 */
export function questionProgressLabel(current, total) {
  return questionProgressCopy(current, total).en;
}

/**
 * @param {number} number
 * @param {boolean} answered
 */
export function questionJumpCopy(number, answered) {
  if (answered) {
    return { en: `Question ${number}, answered`, zh: `第 ${number} 題，已作答` };
  }
  return { en: `Question ${number}, not answered`, zh: `第 ${number} 題，未作答` };
}

/**
 * @param {number} number
 * @param {boolean} answered
 */
export function questionJumpLabel(number, answered) {
  return questionJumpCopy(number, answered).en;
}

/**
 * @param {number} count
 * @returns {{ en: string, zh: string } | null}
 */
export function unansweredCountCopy(count) {
  if (!Number.isInteger(count) || count <= 0) return null;
  if (count === 1) {
    return { en: examLabels.oneUnanswered, zh: examLabelsZh.oneUnanswered };
  }
  return {
    en: `${count} questions are not answered`,
    zh: `有 ${count} 題未作答`,
  };
}

/**
 * @param {number} count
 * @returns {string | null}
 */
export function unansweredCountLabel(count) {
  return unansweredCountCopy(count)?.en ?? null;
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
