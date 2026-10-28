const SIGNED_WHOLE_NUMBER = /^-?(?:0|[1-9]\d*)$/;

export const FRACTION_BLANK_MESSAGE = "Enter a whole number in both boxes.";
export const FRACTION_INTEGER_MESSAGE = "Use whole numbers only.";
export const FRACTION_DENOMINATOR_MESSAGE = "The denominator must be greater than 0.";

export type FractionAnswer =
  | { ok: true; answer: string }
  | { ok: false; message: string | null };

export function readFractionParts(value: string): {
  numerator: string;
  denominator: string;
} {
  const slash = value.indexOf("/");
  if (slash === -1) return { numerator: value, denominator: "" };
  return {
    numerator: value.slice(0, slash),
    denominator: value.slice(slash + 1),
  };
}

function isWholeNumber(value: string) {
  return SIGNED_WHOLE_NUMBER.test(value) && value !== "-0";
}

// Keeps the digits the student typed. 2/6 stays 2/6.
export function fractionAnswer(numerator: string, denominator: string): FractionAnswer {
  const a = numerator.trim();
  const b = denominator.trim();
  if (a === "" && b === "") return { ok: false, message: null };

  if ((a !== "" && !isWholeNumber(a)) || (b !== "" && !isWholeNumber(b))) {
    return { ok: false, message: FRACTION_INTEGER_MESSAGE };
  }
  if (a === "" || b === "") {
    return { ok: false, message: FRACTION_BLANK_MESSAGE };
  }
  if (b === "0" || b.startsWith("-")) {
    return { ok: false, message: FRACTION_DENOMINATOR_MESSAGE };
  }
  return { ok: true, answer: `${a}/${b}` };
}
