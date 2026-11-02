import type { ReviewVerdict } from "./marking";

// English copy for the results review and regrade screens.
// Lane E translates this file later. Do not scatter these sentences.

export const labels = {
  review: "Review",
  results: "Results",
  backToResults: "Back to results",
  editQuestion: "Edit question",
  question: "Question",
  studentAnswer: "Student answer",
  systemJudgement: "System judgement",
  correctAnswer: "Correct answer",
  teacherState: "Teacher",
  confirm: "Confirm",
  edit: "Edit",
  saveEdit: "Save edit",
  saving: "Saving…",
  note: "Note (optional)",
  notePlaceholder: "Why this mark changed",
  markCorrect: "Correct",
  markIncorrect: "Incorrect",
  queueMarkCorrect: "Mark correct",
  queueMarkIncorrect: "Mark incorrect",
  notGraded: "Not graded",
  unconfirmed: "Unconfirmed",
  aTeacher: "a teacher",
  emptyAnswer: "(empty answer)",
  noCorrectAnswer: "(none stored)",
  noQuestions: "No questions on this sitting.",
  notSubmitted: "This sitting is not submitted yet.",
  sittingNotFound: "This sitting was not found.",
  couldNotLoad: "Could not load this sitting.",
  noStoredAnswer: "No stored answer to mark.",
  systemUnknown: "Original system mark was not kept.",
  markingWaiting:
    "Teacher marking is waiting for a database update. Nothing was saved.",
  confirmClearsOverride: "Confirm accepts the system mark and clears an override.",
  railLegend:
    "Light green is correct. Red is incorrect. Grey is not graded. A ring means confirmed. A dark left edge means overridden.",
  questionRail: "Question numbers",
  countsAs: "This question counts as",
  score: "Score",
  scoreDetail: "The total uses an override when a teacher has set one. Unanswered questions stay in the total and count as incorrect.",
  notFinalized: "Not finalized",
  changedSinceFinalize: "Changed since finalize",
  finalize: "Finalize grade",
  refinalize: "Re-finalize grade",
  finalizing: "Finalizing…",
  finalizedAt: (percent: number) => `Finalized at ${percent}%.`,
  finalizedBadge: (percent: number, when: string) =>
    when ? `Finalized ${percent}% · ${when}` : `Finalized ${percent}%`,
  pendingReview: (count: number) =>
    count === 1
      ? "1 response needs review before this grade can be finalized."
      : `${count} responses need review before this grade can be finalized.`,
  pendingFinalize: (count: number) =>
    count === 1
      ? "1 response still needs review. Mark it correct or incorrect before finalizing."
      : `${count} responses still need review. Mark them correct or incorrect before finalizing.`,
  unanswered: (count: number) =>
    count === 1
      ? "1 assigned question was not answered and counts as incorrect."
      : `${count} assigned questions were not answered and count as incorrect.`,
  scoreLine: (correct: number, total: number, percent: number | null) =>
    percent === null ? `${correct}/${total} correct` : `${correct}/${total} correct (${percent}%)`,
  toReview: (count: number) => (count === 1 ? "1 to review" : `${count} to review`),
  confirmAll: (count: number) => `Confirm all (${count})`,
  confirmAllDetail: (count: number) =>
    count === 0
      ? "Every stored answer is already confirmed or overridden."
      : count === 1
        ? "1 unconfirmed answer will be confirmed."
        : `${count} unconfirmed answers will be confirmed.`,
  regradeTitle: "Regrade affected students",
  regradeApply: "Regrade affected students",
  applying: "Regrading…",
  regradeNotYet:
    "Past results have not changed. Changing the saved correct answer does nothing to stored marks until you regrade.",
  regradeDone: (changed: number, kept: number) =>
    `Regrade saved. ${changed} ${changed === 1 ? "answer was" : "answers were"} updated. ${kept} overridden ${kept === 1 ? "mark was" : "marks were"} kept.`,
  nothingToRegrade: "No stored marks would change.",
  regradeMismatch: "The saved correct answer changed again. Refresh this page before regrading.",
  regradeFailed: "Could not regrade. Nothing was saved.",
  preservedOverrides: (count: number) =>
    count === 0
      ? "No overridden marks to keep."
      : count === 1
        ? "1 overridden mark will be kept."
        : `${count} overridden marks will be kept.`,
  wouldChange: (students: number, answers: number) => {
    if (answers === 0) return "No stored marks would change.";
    const studentText = students === 1 ? "1 student" : `${students} students`;
    const answerText = answers === 1 ? "1 answer" : `${answers} answers`;
    return `${studentText} would change (${answerText}).`;
  },
  previousCorrect: "Previous correct answer",
  newCorrect: "New correct answer",
  now: "Stored mark",
  after: "After regrade",
  student: "Student",
  answer: "Answer",
  questionNotFound: "Question not found.",
  couldNotLoadRegrade: "Could not load answers for this question.",
  signIn: "You are not signed in. Refresh and log in again.",
  staffOnly: "Staff only.",
  adminOnly: "Only an admin can change grades.",
  missingResponse: "Missing response.",
  missingSitting: "Missing student sitting.",
  sittingMissing: "This student sitting was not found.",
  submittedOnly: "Only submitted exams can be finalized.",
  couldNotLoadResponses: "Could not load responses. Try again.",
  noQuestionsToGrade: "This student has no questions to grade.",
  couldNotSaveGrade: "Could not save the final grade. You may not have permission.",
  couldNotSaveMark: "Could not save this mark. You may not have permission.",
  responseMissing: "This response was not found.",
  chooseVerdict: "Choose correct or incorrect.",
  notWaiting: "This response is no longer waiting for review.",
  couldNotSaveReview: "Could not save this review. You may not have permission.",
  missingResponseId: "Missing response id.",
  unknownExam: "Exam",
  gradeExamNotFound: "Exam not found",
  studentSittingNotFound: "Student sitting not found",
  needsTeacher: "Needs a teacher",
  editLegend: "Set this answer correct or incorrect",
  confirmedBy: (who: string, when: string) => `Confirmed by ${who} · ${when}`,
  confirmedByNoTime: (who: string) => `Confirmed by ${who}`,
  overriddenBy: (who: string, when: string) => `Overridden by ${who} · ${when}`,
  overriddenByNoTime: (who: string) => `Overridden by ${who}`,
};

export function answeredWarning(count: number): string | null {
  if (count <= 0) return null;
  const lead =
    count === 1
      ? "1 student has already answered this question."
      : `${count} students have already answered this question.`;
  return `${lead} Changing the correct answer will not change their results until you choose Regrade.`;
}

export function markWord(value: boolean | null): string {
  if (value === true) return labels.markCorrect;
  if (value === false) return labels.markIncorrect;
  return labels.notGraded;
}

export function verdictWord(verdict: ReviewVerdict): string {
  if (verdict === "correct") return "correct";
  if (verdict === "incorrect") return "incorrect";
  return "not graded";
}

export function teacherStateLabel(input: {
  state: "unconfirmed" | "confirmed" | "overridden";
  who: string | null;
  when: string;
}): string {
  if (input.state === "unconfirmed") return labels.unconfirmed;
  const who = input.who?.trim() || labels.aTeacher;
  const when = input.when.trim();
  if (input.state === "confirmed") {
    return when ? labels.confirmedBy(who, when) : labels.confirmedByNoTime(who);
  }
  return when ? labels.overriddenBy(who, when) : labels.overriddenByNoTime(who);
}

export function questionRailLabel(number: number, verdict: ReviewVerdict, state: string): string {
  return `Question ${number}, ${verdictWord(verdict)}, ${state}`;
}
