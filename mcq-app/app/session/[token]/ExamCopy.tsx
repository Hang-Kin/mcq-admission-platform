import type { ReactNode } from "react";

/** English stays in the page. CSS shows Traditional Chinese only for that language setting. */
export function ExamCopy({ en, zh }: { en: string; zh: string }): ReactNode {
  if (!zh || en === zh) return en;
  return (
    <>
      <span className="shell-en">{en}</span>
      <span className="shell-zh">{zh}</span>
    </>
  );
}
