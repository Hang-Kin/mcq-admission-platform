export type ScoredResponse = {
  is_correct: boolean | null;
  needs_review?: boolean | null;
};

export type GradeScore = {
  correct: number;
  total: number;
  pendingReview: number;
  percent: number | null;
};

export function scoreResponses(responses: ScoredResponse[]): GradeScore {
  const total = responses.length;
  const correct = responses.filter((r) => r.is_correct === true).length;
  const pendingReview = responses.filter((r) => r.needs_review === true).length;
  const percent =
    total === 0 ? null : Math.round((correct / total) * 1000) / 10;
  return { correct, total, pendingReview, percent };
}

export function isGradeStale(
  finalGrade: number | string | null | undefined,
  score: GradeScore,
): boolean {
  if (finalGrade === null || finalGrade === undefined) return false;
  if (score.percent === null) return true;
  return Number(finalGrade) !== score.percent;
}

export function orderByAssigned<
  T extends { question_id: string; category: string; question_text: string },
>(responses: T[], assignedIds: unknown): T[] {
  const order = new Map<string, number>();
  if (Array.isArray(assignedIds)) {
    assignedIds.forEach((id, index) => order.set(String(id), index));
  }
  return [...responses].sort((a, b) => {
    const ai = order.get(a.question_id);
    const bi = order.get(b.question_id);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return (
      a.category.localeCompare(b.category) ||
      a.question_text.localeCompare(b.question_text)
    );
  });
}
