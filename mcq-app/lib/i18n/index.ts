import type { Locale } from "./locale";
import { results } from "./results";
import { schedule } from "./schedule";
import { session } from "./session";
import { shell } from "./shell";
import { students } from "./students";

export { isLocale, LOCALES, type Locale } from "./locale";

const catalogs = { shell, schedule, results, students, session } as const;

type CatalogName = keyof typeof catalogs;

function lookup(tree: unknown, path: string[]): string | undefined {
  let node: unknown = tree;
  for (const part of path) {
    if (!node || typeof node !== "object" || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Translate `area.rest.of.key`. Unknown keys come back unchanged. */
export function t(key: string, locale: Locale): string {
  const dot = key.indexOf(".");
  if (dot <= 0) return key;
  const area = key.slice(0, dot);
  if (!(area in catalogs)) return key;
  const path = key.slice(dot + 1).split(".").filter(Boolean);
  if (path.length === 0) return key;
  const catalog = catalogs[area as CatalogName];
  const local = lookup(catalog[locale], path);
  if (local) return local;
  const english = lookup(catalog.en, path);
  if (english) return english;
  return key;
}
