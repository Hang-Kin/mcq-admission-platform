export type PhraseMap = Record<string, readonly [string, string]>;

export function phraseTree(phrases: PhraseMap, locale: "en" | "zh-Hant"): Record<string, unknown> {
  const index = locale === "en" ? 0 : 1;
  const root: Record<string, unknown> = {};
  for (const [path, pair] of Object.entries(phrases)) {
    const parts = path.split(".").filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i]!;
      const next = node[part];
      if (!next || typeof next !== "object") node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]!] = pair[index];
  }
  return root;
}
