export type SectionTimeslotCell = {
  timeslotId: string;
  sectionId: string;
  questionSet: string;
};

export type SectionTimeslotWrite = {
  timeslotId: string;
  sectionId: string;
  questionSet: string;
};

export type SectionTimeslotClear = {
  timeslotId: string;
  sectionId: string;
};

const CELL_PREFIX = "set__";

export function sectionTimeslotCellKey(timeslotId: string, sectionId: string) {
  return `${CELL_PREFIX}${timeslotId}__${sectionId}`;
}

export function cellsFromFormEntries(
  entries: Iterable<[string, string]>,
): SectionTimeslotCell[] | { error: string } {
  const cells: SectionTimeslotCell[] = [];
  for (const [key, value] of entries) {
    if (!key.startsWith(CELL_PREFIX)) continue;
    const rest = key.slice(CELL_PREFIX.length);
    const splitAt = rest.indexOf("__");
    if (splitAt <= 0 || splitAt !== rest.lastIndexOf("__")) {
      return { error: "A section question set was not submitted correctly." };
    }
    const timeslotId = rest.slice(0, splitAt);
    const sectionId = rest.slice(splitAt + 2);
    if (!timeslotId || !sectionId) {
      return { error: "A section question set was not submitted correctly." };
    }
    cells.push({ timeslotId, sectionId, questionSet: value });
  }
  return cells;
}

export function planSectionTimeslotQuestionSets(
  cells: SectionTimeslotCell[],
  existing: SectionTimeslotWrite[],
): { upserts: SectionTimeslotWrite[]; clears: SectionTimeslotClear[] } {
  const current = new Map(
    existing.map((row) => [
      `${row.timeslotId}:${row.sectionId}`,
      row.questionSet,
    ]),
  );
  const upserts: SectionTimeslotWrite[] = [];
  const clears: SectionTimeslotClear[] = [];

  for (const cell of cells) {
    const questionSet = cell.questionSet.trim();
    const key = `${cell.timeslotId}:${cell.sectionId}`;
    const previous = current.get(key);
    if (!questionSet) {
      if (previous !== undefined) {
        clears.push({
          timeslotId: cell.timeslotId,
          sectionId: cell.sectionId,
        });
      }
      continue;
    }
    if (previous === questionSet) continue;
    upserts.push({
      timeslotId: cell.timeslotId,
      sectionId: cell.sectionId,
      questionSet,
    });
  }

  return { upserts, clears };
}
