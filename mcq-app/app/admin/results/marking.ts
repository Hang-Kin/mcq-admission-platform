export type ReviewVerdict = "correct" | "incorrect" | "not-graded";

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

export type ReviewQuestionInput = {
  id: string;
  questionText: string;
  category: string;
  subject: string | null;
  correctAnswer: string | null;
};

export type ReviewResponseInput = {
  questionId: string;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  needsReview?: boolean | null;
};

export type ReviewQuestion = {
  number: number;
  id: string;
  questionText: string;
  category: string;
  subject: string | null;
  studentAnswer: string;
  correctAnswer: string;
  verdict: ReviewVerdict;
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
    const studentAnswer = response?.studentAnswer?.trim() ? response.studentAnswer : "";
    return {
      number: index + 1,
      id: item.question_id,
      questionText: question?.questionText ?? "Unknown question",
      category: question?.category ?? "",
      subject: question?.subject ?? null,
      studentAnswer,
      correctAnswer: question?.correctAnswer?.trim() ?? "",
      verdict: reviewVerdict({
        hasResponse: response !== null,
        isCorrect: response?.isCorrect ?? null,
      }),
      needsReview: response?.needsReview === true,
    };
  });
}
