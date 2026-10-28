export type MathPiece =
  | { kind: "text"; text: string }
  | { kind: "fraction"; numerator: string; denominator: string }
  | { kind: "mixed"; whole: string; numerator: string; denominator: string };

const UNSIGNED_INTEGER = /^\d+$/;

export function isMathQuestion(question: {
  subject?: string | null;
  category?: string | null;
}): boolean {
  const subject = question.subject?.trim();
  if (subject) return subject.toLowerCase() === "math";
  return (question.category ?? "").trim().toLowerCase() === "math";
}

export function readQuestionSubject(value: object): string | null {
  if (!("subject" in value)) return null;
  return typeof value.subject === "string" ? value.subject : null;
}

export function isMissingSubjectColumn(message: string | undefined): boolean {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes("subject") &&
    (text.includes("column") ||
      text.includes("schema cache") ||
      text.includes("does not exist"))
  );
}

function isBoundary(text: string, index: number) {
  if (index <= 0) return true;
  return !/[A-Za-z0-9.]/.test(text[index - 1] ?? "");
}

function readAtom(
  text: string,
  index: number,
): { value: string; next: number } | null {
  const rest = text.slice(index);
  const integer = /^-?\d+/.exec(rest);
  if (integer) {
    const value = integer[0];
    const end = index + value.length;
    const next = text[end] ?? "";
    if (next === "." && /\d/.test(text[end + 1] ?? "")) return null;
    if (/[A-Za-z]/.test(next)) return null;
    return { value, next: end };
  }

  if (!/^[A-Za-z]/.test(rest)) return null;
  const end = index + 1;
  if (/[A-Za-z0-9.]/.test(text[end] ?? "")) return null;
  return { value: rest[0] ?? "", next: end };
}

function readSlashChain(
  text: string,
  index: number,
): { raw: string; parts: string[]; end: number } | null {
  if (!isBoundary(text, index)) return null;
  const first = readAtom(text, index);
  if (!first || text[first.next] !== "/") return null;

  const parts = [first.value];
  let cursor = first.next;
  while (text[cursor] === "/") {
    const next = readAtom(text, cursor + 1);
    if (!next) return null;
    parts.push(next.value);
    cursor = next.next;
  }

  if (parts.length < 2) return null;
  return { raw: text.slice(index, cursor), parts, end: cursor };
}

function pushText(pieces: MathPiece[], value: string) {
  if (!value) return;
  const last = pieces[pieces.length - 1];
  if (last?.kind === "text") {
    last.text += value;
    return;
  }
  pieces.push({ kind: "text", text: value });
}

function peelMixedWhole(pieces: MathPiece[]): string | null {
  const last = pieces[pieces.length - 1];
  if (last?.kind !== "text") return null;
  const match = /(^|[^\dA-Za-z.])(\d+) +$/.exec(last.text);
  const whole = match?.[2];
  if (!match || !whole) return null;
  const boundary = match[1] ?? "";
  const consumed = match[0].slice(boundary.length);
  const kept = last.text.slice(0, last.text.length - consumed.length);
  if (kept) last.text = kept;
  else pieces.pop();
  return whole;
}

// A slash chain of exactly two integers or single letters is a fraction.
// Three or more parts, such as the date 1/2/2026, stay as typed text.
export function parseMathText(input: string): MathPiece[] {
  const pieces: MathPiece[] = [];
  let index = 0;

  while (index < input.length) {
    const chain = readSlashChain(input, index);
    if (!chain) {
      pushText(pieces, input[index] ?? "");
      index += 1;
      continue;
    }

    if (chain.parts.length === 2) {
      const numerator = chain.parts[0] ?? "";
      const denominator = chain.parts[1] ?? "";
      if (UNSIGNED_INTEGER.test(numerator) && UNSIGNED_INTEGER.test(denominator)) {
        const whole = peelMixedWhole(pieces);
        if (whole) {
          pieces.push({
            kind: "mixed",
            whole,
            numerator,
            denominator,
          });
          index = chain.end;
          continue;
        }
      }
      pieces.push({ kind: "fraction", numerator, denominator });
      index = chain.end;
      continue;
    }

    pushText(pieces, chain.raw);
    index = chain.end;
  }

  return pieces;
}
