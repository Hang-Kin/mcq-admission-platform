export type FractionCheck =
  | { kind: "empty"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "simplified"; message: string; canonical: string }
  | { kind: "not-simplified"; message: string; canonical: string };

const WHOLE_NUMBER = /^-?(?:0|[1-9][0-9]*)$/;

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function parseWholeNumber(raw: string): number | null {
  if (!WHOLE_NUMBER.test(raw) || raw === "-0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || String(value) !== raw) return null;
  return value;
}

export function fractionCheck(numerator: string, denominator: string): FractionCheck {
  const aRaw = numerator.trim();
  const bRaw = denominator.trim();

  if (!aRaw && !bRaw) {
    return {
      kind: "empty",
      message: "Enter a and b. Save only a simplified fraction.",
    };
  }

  const a = parseWholeNumber(aRaw);
  const b = parseWholeNumber(bRaw);
  if (a === null || b === null || b <= 0) {
    return {
      kind: "invalid",
      message: "Use whole numbers. b must be greater than 0.",
    };
  }

  const divisor = gcd(a, b);
  const canonical = `${a / divisor}/${b / divisor}`;
  if (divisor === 1) {
    return { kind: "simplified", message: "Simplified.", canonical };
  }

  return {
    kind: "not-simplified",
    message: `Not simplified. Enter ${canonical}.`,
    canonical,
  };
}

export function splitFraction(value: string | null | undefined): { a: string; b: string } {
  const text = value?.trim() ?? "";
  const slash = text.indexOf("/");
  if (slash <= 0 || slash !== text.lastIndexOf("/")) return { a: "", b: "" };
  return { a: text.slice(0, slash), b: text.slice(slash + 1) };
}
