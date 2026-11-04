import { t, type Locale } from "@/lib/i18n/index";
import { results } from "@/lib/i18n/results";
import { schedule } from "@/lib/i18n/schedule";
import { shell } from "@/lib/i18n/shell";
import { students } from "@/lib/i18n/students";

const NUMBER_NAMES = new Set([
  "count",
  "total",
  "percent",
  "math",
  "chinese",
  "year",
  "coded",
  "kept",
  "changed",
  "minutes",
  "correct",
  "need",
  "number",
  "perTopic",
  "started",
  "missing",
  "failed",
  "waiting",
  "added",
  "already",
  "errors",
]);

type Entry = {
  id: string;
  en: string;
  names: string[];
  regex: RegExp | null;
  literals: number;
};

export type PhraseMatch = { id: string; values: Record<string, string> };

function leaves(tree: unknown, prefix: string): Array<[string, string]> {
  if (typeof tree === "string") return [[prefix, tree]];
  if (!tree || typeof tree !== "object") return [];
  return Object.entries(tree).flatMap(([key, value]) => leaves(value, prefix ? `${prefix}.${key}` : key));
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$|?*+()[\]{}.]/g, "\\$&");
}

function compile(id: string, en: string): Entry | null {
  if (!en.includes("{")) return { id, en, names: [], regex: null, literals: en.length };
  const names: string[] = [];
  const parts: string[] = [];
  const pattern = /\{(\w+)\}/g;
  let last = 0;
  let literals = 0;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(en))) {
    const literal = en.slice(last, found.index);
    literals += literal.length;
    parts.push(escapeRegExp(literal));
    names.push(found[1]!);
    last = found.index + found[0].length;
  }
  const tail = en.slice(last);
  literals += tail.length;
  parts.push(escapeRegExp(tail));
  if (literals < 2) return null;
  const textNames = names.filter((name) => !NUMBER_NAMES.has(name));
  let seenText = 0;
  let source = "^";
  names.forEach((name, index) => {
    source += parts[index] ?? "";
    if (NUMBER_NAMES.has(name)) source += "(\\d+)";
    else {
      seenText += 1;
      source += seenText === textNames.length ? "(.+)" : "(.+?)";
    }
  });
  source += parts[names.length] ?? "";
  source += "$";
  return { id, en, names, regex: new RegExp(source), literals };
}

const catalogs = [
  ["shell", shell.en],
  ["schedule", schedule.en],
  ["results", results.en],
  ["students", students.en],
] as const;

const entries: Entry[] = [];
for (const [area, tree] of catalogs) {
  for (const [path, value] of leaves(tree, area)) {
    const compiled = compile(path, value);
    if (compiled) entries.push(compiled);
  }
}

const exact = new Map<string, string>();
const templates: Entry[] = [];
for (const entry of entries) {
  if (!entry.regex) {
    if (!exact.has(entry.en)) exact.set(entry.en, entry.id);
    continue;
  }
  templates.push(entry);
}
templates.sort((a, b) => b.literals - a.literals || b.en.length - a.en.length);

export function normalizeCopy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function matchPhrase(text: string): PhraseMatch | null {
  const normalized = normalizeCopy(text);
  if (!normalized) return null;
  const exactId = exact.get(normalized);
  if (exactId) return { id: exactId, values: {} };
  for (const entry of templates) {
    const found = entry.regex?.exec(normalized);
    if (!found) continue;
    const values: Record<string, string> = {};
    entry.names.forEach((name, index) => {
      values[name] = found[index + 1] ?? "";
    });
    if (fill(t(entry.id, "en"), values) !== normalized) continue;
    return { id: entry.id, values };
  }
  return null;
}

export function fill(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
}

export function phrase(text: string, locale: Locale, depth = 0): string {
  const normalized = normalizeCopy(text);
  const hit = matchPhrase(normalized);
  if (!hit || depth > 5) return text;
  const template = t(hit.id, locale);
  if (template === hit.id) return text;
  const filled = template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const raw = hit.values[name] ?? "";
    const nested = depth < 5 ? matchPhrase(raw) : null;
    if (!nested || nested.id === hit.id) return raw;
    return phrase(raw, locale, depth + 1);
  });
  return filled;
}

export function phraseParts(text: string): Array<{ text: string } | PhraseMatch> {
  const normalized = normalizeCopy(text);
  const whole = matchPhrase(normalized);
  if (whole) return [whole];
  if (!normalized.includes(". ")) return [{ text: text }];
  const parts = normalized.split(/(?<=\.)\s+/);
  const matched = parts.map((part) => matchPhrase(part));
  if (!matched.some(Boolean)) return [{ text: text }];
  return parts.map((part, index) => matched[index] ?? { text: part });
}

export function sameEnglishAgrees(): string[] {
  const chinese = new Map<string, string>();
  const problems: string[] = [];
  for (const [area, tree] of catalogs) {
    for (const [path, value] of leaves(tree, area)) {
      const previous = chinese.get(value);
      const translated = t(path, "zh-Hant");
      if (previous != null && previous !== translated) problems.push(`${value} => ${previous} / ${translated}`);
      else chinese.set(value, translated);
    }
  }
  return problems;
}
