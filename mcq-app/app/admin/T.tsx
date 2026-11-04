import type { ReactNode } from "react";

import { t, type Locale } from "@/lib/i18n/index";

import { phrase, phraseParts, type PhraseMatch } from "./translate";

function both(id: string, values: Record<string, string | number> | undefined, locale: Locale): string {
  const template = t(id, locale);
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => phrase(String(values[name] ?? ""), locale));
}

export function T({
  id,
  values,
}: {
  id: string;
  values?: Record<string, string | number>;
}): ReactNode {
  const en = both(id, values, "en");
  const zh = both(id, values, "zh-Hant");
  if (en === zh) return en;
  return (
    <>
      <span className="shell-en">{en}</span>
      <span className="shell-zh">{zh}</span>
    </>
  );
}

function Part({ part }: { part: { text: string } | PhraseMatch }): ReactNode {
  if ("text" in part) return part.text;
  return <T id={part.id} values={part.values} />;
}

/** Translate a sentence the screen already built in English. */
export function TText({ text }: { text: string }): ReactNode {
  const parts = phraseParts(text);
  if (parts.length === 1 && "text" in parts[0]!) return parts[0].text;
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? " " : null}
          <Part part={part} />
        </span>
      ))}
    </>
  );
}
