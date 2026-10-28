import assert from "node:assert/strict";
import test from "node:test";

import {
  isMathQuestion,
  parseMathText,
  type MathPiece,
} from "./mathText.ts";

function sourceText(pieces: MathPiece[]) {
  return pieces
    .map((piece) => {
      if (piece.kind === "text") return piece.text;
      if (piece.kind === "fraction") {
        return `${piece.numerator}/${piece.denominator}`;
      }
      return `${piece.whole} ${piece.numerator}/${piece.denominator}`;
    })
    .join("");
}

test("stacks each fraction and keeps the multiplication sign", () => {
  const input = "3/8 × 4/9 + 5/12";
  const pieces = parseMathText(input);

  assert.equal(sourceText(pieces), input);
  assert.deepEqual(pieces, [
    { kind: "fraction", numerator: "3", denominator: "8" },
    { kind: "text", text: " × " },
    { kind: "fraction", numerator: "4", denominator: "9" },
    { kind: "text", text: " + " },
    { kind: "fraction", numerator: "5", denominator: "12" },
  ]);
});

test("renders a mixed number and keeps the multiplication sign", () => {
  const input = "(2 1/4 - 7/8) × 4/11";
  const pieces = parseMathText(input);

  assert.equal(sourceText(pieces), input);
  assert.deepEqual(pieces, [
    { kind: "text", text: "(" },
    { kind: "mixed", whole: "2", numerator: "1", denominator: "4" },
    { kind: "text", text: " - " },
    { kind: "fraction", numerator: "7", denominator: "8" },
    { kind: "text", text: ") × " },
    { kind: "fraction", numerator: "4", denominator: "11" },
  ]);
});

test("stacks a single-letter numerator", () => {
  const input = "m/6 + 5/8 = 23/24";
  const pieces = parseMathText(input);

  assert.equal(sourceText(pieces), input);
  assert.deepEqual(pieces, [
    { kind: "fraction", numerator: "m", denominator: "6" },
    { kind: "text", text: " + " },
    { kind: "fraction", numerator: "5", denominator: "8" },
    { kind: "text", text: " = " },
    { kind: "fraction", numerator: "23", denominator: "24" },
  ]);
});

test("does not alter a normal sentence that contains a date", () => {
  const input = "Bring the form on 1/2/2026, and/or send it earlier.";
  const pieces = parseMathText(input);

  assert.deepEqual(pieces, [{ kind: "text", text: input }]);
  assert.equal(sourceText(pieces), input);
});

test("keeps a typed division sign", () => {
  const input = "8 ÷ 1/4";
  const pieces = parseMathText(input);

  assert.equal(sourceText(pieces), input);
  assert.deepEqual(pieces, [
    { kind: "text", text: "8 ÷ " },
    { kind: "fraction", numerator: "1", denominator: "4" },
  ]);
});

test("math display follows the subject, then a legacy Math category", () => {
  assert.equal(isMathQuestion({ subject: "Math", category: "Fractions" }), true);
  assert.equal(isMathQuestion({ subject: " math " }), true);
  assert.equal(isMathQuestion({ subject: "Chinese", category: "Math" }), false);
  assert.equal(isMathQuestion({ category: "Math" }), true);
  assert.equal(isMathQuestion({ category: "math" }), true);
  assert.equal(isMathQuestion({ category: "成語" }), false);
  assert.equal(isMathQuestion({ subject: null, category: "Geography" }), false);
});
