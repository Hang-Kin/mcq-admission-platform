export type ReviewVerdict = "correct" | "incorrect" | "not-graded";

export type TeacherMarkState = "unconfirmed" | "confirmed" | "overridden";

export type TeacherMark = {
  state: TeacherMarkState;
  snapshotKnown: boolean;
  snapshot: boolean | null;
  overrideIsCorrect: boolean | null;
  note: string | null;
  markedByLabel: string | null;
  markedAt: string | null;
};

export function reviewVerdict(input: {
  hasResponse: boolean;
  isCorrect: boolean | null;
}): ReviewVerdict {
  if (!input.hasResponse) return "incorrect";
  if (input.isCorrect === true) return "correct";
  if (input.isCorrect === false) return "incorrect";
  return "not-graded";
}

export function wrongAnswerHighlighted(verdict: ReviewVerdict): boolean {
  return verdict === "incorrect";
}

export function emptyTeacherMark(): TeacherMark {
  return {
    state: "unconfirmed",
    snapshotKnown: true,
    snapshot: null,
    overrideIsCorrect: null,
    note: null,
    markedByLabel: null,
    markedAt: null,
  };
}

export function teacherMarkState(input: {
  state?: string | null;
  overrideIsCorrect?: boolean | null;
}): TeacherMarkState {
  if (input.state === "overridden") return "overridden";
  if (input.overrideIsCorrect === true || input.overrideIsCorrect === false) return "overridden";
  if (input.state === "confirmed") return "confirmed";
  return "unconfirmed";
}

export function finalIsCorrect(
  systemIsCorrect: boolean | null,
  overrideIsCorrect: boolean | null,
): boolean | null {
  if (overrideIsCorrect === true || overrideIsCorrect === false) return overrideIsCorrect;
  return systemIsCorrect;
}

export function systemJudgement(input: {
  storedIsCorrect: boolean | null;
  mark: TeacherMark;
}): { known: boolean; isCorrect: boolean | null } {
  if (input.mark.state === "overridden") {
    if (!input.mark.snapshotKnown) return { known: false, isCorrect: null };
    return { known: true, isCorrect: input.mark.snapshot };
  }
  return { known: true, isCorrect: input.storedIsCorrect };
}

export function effectiveNeedsReview(
  needsReview: boolean | null | undefined,
  state: TeacherMarkState,
): boolean {
  if (state === "confirmed" || state === "overridden") return false;
  return needsReview === true;
}

export function confirmAllCount(
  items: Array<{ state: TeacherMarkState; responseId: string | null }>,
): number {
  return items.filter((item) => item.responseId && item.state === "unconfirmed").length;
}

function boolOrNull(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

export function teacherMarkFromRecord(record: Record<string, unknown> | null): TeacherMark {
  if (!record) return emptyTeacherMark();
  const override = boolOrNull(record.override_is_correct);
  const state = teacherMarkState({
    state: typeof record.state === "string" ? record.state : null,
    overrideIsCorrect: override,
  });
  return {
    state,
    snapshotKnown: record.system_mark_known !== false,
    snapshot: boolOrNull(record.system_is_correct),
    overrideIsCorrect: state === "overridden" ? override : null,
    note: typeof record.note === "string" && record.note.trim() ? record.note.trim() : null,
    markedByLabel:
      typeof record.marked_by_label === "string" && record.marked_by_label.trim()
        ? record.marked_by_label.trim()
        : null,
    markedAt: typeof record.marked_at === "string" ? record.marked_at : null,
  };
}

export function teacherMarkFromEmbed(embed: unknown): TeacherMark {
  const row = Array.isArray(embed) ? embed[0] : embed;
  if (!row || typeof row !== "object") return emptyTeacherMark();
  return teacherMarkFromRecord(row as Record<string, unknown>);
}

export function scoreRow(input: {
  is_correct: boolean | null;
  needs_review?: boolean | null;
  response_marks?: unknown;
}): { is_correct: boolean | null; needs_review: boolean } {
  const mark = teacherMarkFromEmbed(input.response_marks);
  const override = mark.state === "overridden" ? mark.overrideIsCorrect : null;
  return {
    is_correct: finalIsCorrect(input.is_correct, override),
    needs_review: effectiveNeedsReview(input.needs_review, mark.state),
  };
}

export function railCellClass(verdict: ReviewVerdict, state: TeacherMarkState): string {
  const color =
    verdict === "correct"
      ? "bg-accent text-accent-foreground"
      : verdict === "incorrect"
        ? "bg-destructive text-destructive-foreground"
        : "bg-muted text-muted-foreground";
  const mark =
    state === "overridden"
      ? "border-l-4 border-l-foreground"
      : state === "confirmed"
        ? "ring-2 ring-inset ring-foreground"
        : "";
  return [
    "flex h-10 w-full items-center justify-center rounded-none border-b border-border text-sm font-medium no-underline",
    color,
    mark,
  ]
    .filter(Boolean)
    .join(" ");
}

export function judgementClass(verdict: ReviewVerdict): string {
  if (verdict === "correct") return "border-transparent bg-accent text-accent-foreground";
  if (verdict === "incorrect") return "border-transparent bg-destructive text-destructive-foreground";
  return "border-transparent bg-muted text-muted-foreground";
}

export type ReviewQuestionInput = {
  id: string;
  questionText: string;
  category: string;
  subject: string | null;
  correctAnswer: string | null;
};

export type ReviewResponseInput = {
  questionId: string;
  responseId?: string | null;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  needsReview?: boolean | null;
  mark?: TeacherMark | null;
};

export type ReviewQuestion = {
  number: number;
  id: string;
  responseId: string | null;
  questionText: string;
  category: string;
  subject: string | null;
  studentAnswer: string;
  correctAnswer: string;
  verdict: ReviewVerdict;
  systemVerdict: ReviewVerdict;
  systemKnown: boolean;
  finalCorrect: boolean | null;
  teacherState: TeacherMarkState;
  note: string | null;
  markedByLabel: string | null;
  markedAt: string | null;
  needsReview: boolean;
};

function orderQuestions<T extends { question_id: string; category: string; question_text: string }>(
  questions: T[],
  assignedIds: unknown,
): T[] {
  const order = new Map<string, number>();
  if (Array.isArray(assignedIds)) {
    assignedIds.forEach((id, index) => order.set(String(id), index));
  }
  return [...questions].sort((a, b) => {
    const ai = order.get(a.question_id);
    const bi = order.get(b.question_id);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return a.category.localeCompare(b.category) || a.question_text.localeCompare(b.question_text);
  });
}

export function assembleReview(
  assignedIds: unknown,
  questions: ReviewQuestionInput[],
  responses: ReviewResponseInput[],
): ReviewQuestion[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const responseById = new Map<string, ReviewResponseInput>();
  for (const response of responses) responseById.set(response.questionId, response);

  const seen = new Set<string>();
  const known: Array<{ question_id: string; category: string; question_text: string }> = [];
  const add = (id: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const question = questionById.get(id);
    known.push({
      question_id: id,
      category: question?.category ?? "",
      question_text: question?.questionText ?? "Unknown question",
    });
  };

  if (Array.isArray(assignedIds)) {
    for (const id of assignedIds) {
      if (typeof id === "string") add(id);
    }
  }
  for (const response of responses) add(response.questionId);

  return orderQuestions(known, assignedIds).map((item, index) => {
    const question = questionById.get(item.question_id);
    const response = responseById.get(item.question_id) ?? null;
    const mark = response?.mark ?? emptyTeacherMark();
    const hasResponse = response !== null;
    const stored = response?.isCorrect ?? null;
    const judgement = systemJudgement({ storedIsCorrect: stored, mark });
    const override = hasResponse && mark.state === "overridden" ? mark.overrideIsCorrect : null;
    const finalCorrect = hasResponse ? finalIsCorrect(stored, override) : null;
    const studentAnswer = response?.studentAnswer?.trim() ? response.studentAnswer : "";
    return {
      number: index + 1,
      id: item.question_id,
      responseId: response?.responseId ?? null,
      questionText: question?.questionText ?? "Unknown question",
      category: question?.category ?? "",
      subject: question?.subject ?? null,
      studentAnswer,
      correctAnswer: question?.correctAnswer?.trim() ?? "",
      verdict: reviewVerdict({ hasResponse, isCorrect: finalCorrect }),
      systemVerdict: reviewVerdict({
        hasResponse,
        isCorrect: judgement.known ? judgement.isCorrect : null,
      }),
      systemKnown: hasResponse ? judgement.known : true,
      finalCorrect,
      teacherState: hasResponse ? mark.state : "unconfirmed",
      note: hasResponse ? mark.note : null,
      markedByLabel: hasResponse ? mark.markedByLabel : null,
      markedAt: hasResponse ? mark.markedAt : null,
      needsReview: effectiveNeedsReview(response?.needsReview, hasResponse ? mark.state : "unconfirmed"),
    };
  });
}
