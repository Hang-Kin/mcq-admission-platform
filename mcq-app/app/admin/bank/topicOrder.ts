import { isRealTopic } from "./subjects";

export type TopicOrderRow = {
  category: string;
  display_order: number;
};

export type TopicSummary = {
  name: string;
  count: number;
  short: boolean;
};

export function orderTopics<T extends { name: string }>(
  topics: T[],
  orders: TopicOrderRow[],
): T[] {
  const rank = new Map<string, number>();
  for (const row of orders) {
    if (!Number.isInteger(row.display_order) || row.display_order < 1) continue;
    rank.set(row.category, row.display_order);
  }

  return [...topics].sort((a, b) => {
    const aRank = rank.get(a.name);
    const bRank = rank.get(b.name);
    const aPlaced = aRank != null;
    const bPlaced = bRank != null;
    if (aPlaced && bPlaced && aRank !== bRank) return aRank - bRank;
    if (aPlaced !== bPlaced) return aPlaced ? -1 : 1;
    return a.name.localeCompare(b.name, "zh");
  });
}

export function summarizeTopics(
  categories: Array<string | null | undefined>,
  orders: TopicOrderRow[],
  need: number,
): TopicSummary[] {
  const counts = new Map<string, number>();
  for (const category of categories) {
    if (!isRealTopic(category)) continue;
    const name = category!.trim();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const topics = [...counts.entries()].map(([name, count]) => ({
    name,
    count,
    short: count < need,
  }));

  return orderTopics(topics, orders);
}

export function unfiledCount(categories: Array<string | null | undefined>): number {
  return categories.filter((category) => !isRealTopic(category)).length;
}

export function topicCountText(count: number, need: number): string {
  if (count < need) {
    return `${count} of ${need} questions`;
  }
  return count === 1 ? "1 question" : `${count} questions`;
}
