export type MathSegment = {
  type: "text" | "math";
  value: string;
};

const SYMBOLS: Record<string, string> = {
  times: "×",
  div: "÷",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  ne: "≠",
  neq: "≠",
  left: "",
  right: "",
};

function pushText(segments: MathSegment[], value: string) {
  if (!value) return;
  const last = segments[segments.length - 1];
  if (last?.type === "text") {
    last.value += value;
    return;
  }
  segments.push({ type: "text", value });
}

/** Split on \( \). An opening delimiter with no close stays plain text. */
export function splitMathText(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let index = 0;

  while (index < text.length) {
    const open = text.indexOf("\\(", index);
    if (open < 0) {
      pushText(segments, text.slice(index));
      break;
    }
    const close = text.indexOf("\\)", open + 2);
    if (close < 0) {
      pushText(segments, text.slice(index));
      break;
    }
    pushText(segments, text.slice(index, open));
    segments.push({ type: "math", value: text.slice(open + 2, close) });
    index = close + 2;
  }

  return segments;
}

export function joinMathText(segments: MathSegment[]): string {
  return segments
    .map((segment) =>
      segment.type === "math" ? `\\(${segment.value}\\)` : segment.value,
    )
    .join("");
}

function skipSpace(input: string, index: number): number {
  let cursor = index;
  while (input[cursor] === " " || input[cursor] === "\t") cursor += 1;
  return cursor;
}

function readGroup(
  input: string,
  index: number,
): { value: string; next: number } | null {
  if (input[index] !== "{") return null;
  let depth = 0;
  for (let cursor = index; cursor < input.length; cursor += 1) {
    const char = input[cursor];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return { value: input.slice(index + 1, cursor), next: cursor + 1 };
      }
    }
  }
  return null;
}

function readCommand(input: string, index: number): { name: string; next: number } | null {
  if (input[index] !== "\\") return null;
  const start = index + 1;
  if (!/[A-Za-z]/.test(input[start] ?? "")) return null;
  let end = start + 1;
  while (/[A-Za-z]/.test(input[end] ?? "")) end += 1;
  return { name: input.slice(start, end), next: end };
}

/** Readable fallback for one LaTeX formula. Unknown commands are left in place. */
export function latexToPlain(latex: string): string {
  let index = 0;
  let out = "";

  while (index < latex.length) {
    const command = readCommand(latex, index);
    if (command) {
      if (command.name === "frac") {
        const numerator = readGroup(latex, skipSpace(latex, command.next));
        const denominator = numerator
          ? readGroup(latex, skipSpace(latex, numerator.next))
          : null;
        if (numerator && denominator) {
          out += `${latexToPlain(numerator.value)}/${latexToPlain(denominator.value)}`;
          index = denominator.next;
          continue;
        }
      }
      if (command.name === "sqrt") {
        let cursor = skipSpace(latex, command.next);
        if (latex[cursor] === "[") {
          const end = latex.indexOf("]", cursor);
          if (end >= 0) cursor = skipSpace(latex, end + 1);
        }
        const body = readGroup(latex, cursor);
        if (body) {
          out += `√${latexToPlain(body.value)}`;
          index = body.next;
          continue;
        }
      }
      const symbol = SYMBOLS[command.name];
      if (symbol !== undefined) {
        out += symbol;
        index = command.next;
        continue;
      }
      out += latex.slice(index, command.next);
      index = command.next;
      continue;
    }

    if (latex[index] === "\\" && latex[index + 1]) {
      out += latex[index + 1] === " " ? " " : latex[index + 1];
      index += 2;
      continue;
    }

    if (latex[index] === "^") {
      const group = readGroup(latex, skipSpace(latex, index + 1));
      if (group) {
        out += `^${latexToPlain(group.value)}`;
        index = group.next;
        continue;
      }
      if (latex[index + 1]) {
        out += `^${latex[index + 1]}`;
        index += 2;
        continue;
      }
    }

    if (latex[index] === "{") {
      const group = readGroup(latex, index);
      if (group) {
        out += latexToPlain(group.value);
        index = group.next;
        continue;
      }
    }

    out += latex[index] ?? "";
    index += 1;
  }

  return out;
}

/** Apply latexToPlain to math segments only. Plain text, including Chinese, stays. */
export function textToPlain(text: string): string {
  return splitMathText(text)
    .map((segment) => (segment.type === "math" ? latexToPlain(segment.value) : segment.value))
    .join("");
}
