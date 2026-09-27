export type SectionFields = {
  label: string;
  questionSet: string;
  durationMinutes: string;
};

export type SectionValidationResult =
  | {
      ok: true;
      payload: {
        label: string;
        question_set: string;
        duration_minutes: number;
      };
    }
  | { ok: false; error: string };

export type SectionPosition = {
  id: string;
  position: number;
};

const MAX_DURATION_MINUTES = 10000;

export function validateSectionFields(
  input: SectionFields,
): SectionValidationResult {
  const label = input.label.trim();
  const question_set = input.questionSet.trim();
  const durationRaw = input.durationMinutes.trim();

  if (!label || !question_set || !durationRaw) {
    return { ok: false, error: "Please fill in all required fields." };
  }

  if (!/^\d+$/.test(durationRaw)) {
    return {
      ok: false,
      error: "Duration must be a whole number of minutes.",
    };
  }

  const duration_minutes = Number(durationRaw);
  if (duration_minutes < 1 || duration_minutes > MAX_DURATION_MINUTES) {
    return {
      ok: false,
      error: "Duration must be a whole number of minutes, at least 1.",
    };
  }

  return {
    ok: true,
    payload: { label, question_set, duration_minutes },
  };
}

export function nextSectionPosition(positions: number[]): number {
  if (positions.length === 0) return 0;
  return Math.max(...positions) + 1;
}

export const STARTED_EXAM_DELETE_MESSAGE =
  "A student has already started this exam, so sections can’t be deleted.";

export function deletionBlockMessage(startedSittingCount: number): string | null {
  if (startedSittingCount > 0) return STARTED_EXAM_DELETE_MESSAGE;
  return null;
}

export function positionsAreContiguous(positions: number[]): boolean {
  const sorted = [...positions].sort((a, b) => a - b);
  return sorted.every((position, index) => position === index);
}

export function swapWithNeighbor(
  sections: SectionPosition[],
  sectionId: string,
  direction: "up" | "down",
):
  | { ok: true; updates: SectionPosition[] }
  | { ok: false; error: string } {
  const ordered = [...sections].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
  const index = ordered.findIndex((section) => section.id === sectionId);
  if (index < 0) {
    return { ok: false, error: "This section was not found." };
  }

  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= ordered.length) {
    return {
      ok: false,
      error:
        direction === "up"
          ? "This section is already first."
          : "This section is already last.",
    };
  }

  const current = ordered[index];
  const neighbor = ordered[neighborIndex];
  return {
    ok: true,
    updates: [
      { id: current.id, position: neighbor.position },
      { id: neighbor.id, position: current.position },
    ],
  };
}

export function compactedPositions(
  sections: SectionPosition[],
): SectionPosition[] {
  const sorted = [...sections].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
  const updates: SectionPosition[] = [];
  sorted.forEach((section, index) => {
    if (section.position !== index) {
      updates.push({ id: section.id, position: index });
    }
  });
  return updates;
}
