// Same comparison as submit_answer in migration 019.
// A stored mark is written when the student submits. It is not recomputed
// from questions.correct_answer until a teacher runs regrade.
// Null student answer or null correct answer stays null, matching SQL.
// A blank numeric answer is incorrect, because ''::numeric is not a number.

export function systemMark(input: {
  type: string;
  studentAnswer: string | null;
  correctAnswer: string | null;
}): boolean | null {
  const { type, studentAnswer, correctAnswer } = input;
  if (studentAnswer == null || correctAnswer == null) return null;

  if (type === "numeric") {
    const answer = studentAnswer.trim();
    const correct = correctAnswer.trim();
    if (!answer || !correct) return false;
    const left = Number(answer);
    const right = Number(correct);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    return left === right;
  }

  if (type === "fraction") {
    return studentAnswer.trim() === correctAnswer.trim();
  }

  return studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

export type RegradeSource = {
  responseId: string;
  studentId: string;
  studentLabel: string;
  studentAnswer: string | null;
  systemIsCorrect: boolean | null;
  overridden: boolean;
};

export type RegradeChange = {
  responseId: string;
  studentId: string;
  studentLabel: string;
  studentAnswer: string | null;
  from: boolean | null;
  to: boolean | null;
};

export type RegradePreview = {
  students: number;
  changes: RegradeChange[];
  preservedOverrides: number;
};

export function previewRegrade(input: {
  type: string;
  correctAnswer: string | null;
  rows: RegradeSource[];
}): RegradePreview {
  const changes: RegradeChange[] = [];
  let preservedOverrides = 0;

  for (const row of input.rows) {
    if (row.overridden) {
      preservedOverrides += 1;
      continue;
    }
    const next = systemMark({
      type: input.type,
      studentAnswer: row.studentAnswer,
      correctAnswer: input.correctAnswer,
    });
    if (next !== row.systemIsCorrect) {
      changes.push({
        responseId: row.responseId,
        studentId: row.studentId,
        studentLabel: row.studentLabel,
        studentAnswer: row.studentAnswer,
        from: row.systemIsCorrect,
        to: next,
      });
    }
  }

  const students = new Set(
    changes.map((change) => change.studentId || change.responseId),
  ).size;

  return { students, changes, preservedOverrides };
}

export function countStudents(ids: Array<string | null | undefined>): number {
  const seen = new Set<string>();
  for (const id of ids) {
    if (id) seen.add(id);
  }
  return seen.size;
}

export function regradeUpdates(
  preview: RegradePreview,
): Array<{ id: string; is_correct: boolean | null }> {
  return preview.changes.map((change) => ({
    id: change.responseId,
    is_correct: change.to,
  }));
}
