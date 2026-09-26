export type QuestionSetSummary = {
  name: string | null;
  count: number;
};

export function summarizeQuestionSets(
  values: Array<string | null | undefined>,
): QuestionSetSummary[] {
  const counts = new Map<string, number>();
  let unset = 0;

  for (const value of values) {
    const name = value?.trim() ?? "";
    if (!name) {
      unset += 1;
      continue;
    }
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const named: QuestionSetSummary[] = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  if (unset > 0) {
    named.push({ name: null, count: unset });
  }

  return named;
}

export function questionSetNames(
  values: Array<string | null | undefined>,
): string[] {
  return summarizeQuestionSets(values)
    .map((summary) => summary.name)
    .filter((name): name is string => Boolean(name));
}
