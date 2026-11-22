export type FormulaRange = {
  start: number;
  end: number;
  latex: string;
};

const BROKEN_PASTE = /[\uE000-\uF8FF\uFFFD]/u;
const MISSING_OPERATORS = /(?:^|[^\dA-Za-z.])\d+(?:[ \t]+\d+){2,}(?=$|[^\dA-Za-z.])/;

/** True when a paste looks like a PDF symbol-font failure. Does not rewrite the text. */
export function pasteNeedsFormulaWarning(text: string): boolean {
  if (BROKEN_PASTE.test(text)) return true;
  return MISSING_OPERATORS.test(text);
}

/** The \( ... \) segment containing a collapsed cursor, if the delimiter is closed. */
export function formulaAtCursor(text: string, cursor: number): FormulaRange | null {
  const clamped = Math.min(Math.max(cursor, 0), text.length);
  let searchFrom = 0;

  while (searchFrom <= clamped) {
    const open = text.indexOf("\\(", searchFrom);
    if (open < 0 || open > clamped) return null;
    const close = text.indexOf("\\)", open + 2);
    if (close < 0) return null;
    const end = close + 2;
    if (clamped >= open && clamped < end) {
      return { start: open, end, latex: text.slice(open + 2, close) };
    }
    searchFrom = end;
  }

  return null;
}

export function applyFormula(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  latex: string,
): { text: string; cursor: number } {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const existing = start === end ? formulaAtCursor(text, start) : null;
  const wrapped = latex.length > 0 ? `\\(${latex}\\)` : "";
  const rangeStart = existing ? existing.start : start;
  const rangeEnd = existing ? existing.end : end;
  const next = text.slice(0, rangeStart) + wrapped + text.slice(rangeEnd);
  return { text: next, cursor: rangeStart + wrapped.length };
}
