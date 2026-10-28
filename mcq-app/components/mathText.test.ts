import assert from "node:assert/strict";
import test from "node:test";

import {
  isMathQuestion,
  mathDisplayPieces,
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

test("stacks f/4 + 1/6 = 11/12 without changing the stored text", () => {
  const input = "f/4 + 1/6 = 11/12";
  const pieces = mathDisplayPieces(input, { subject: "Math", category: "Fractions" });

  assert.ok(pieces);
  assert.equal(sourceText(pieces), input);
  assert.equal(input, "f/4 + 1/6 = 11/12");
  assert.deepEqual(pieces, [
    { kind: "fraction", numerator: "f", denominator: "4" },
    { kind: "text", text: " + " },
    { kind: "fraction", numerator: "1", denominator: "6" },
    { kind: "text", text: " = " },
    { kind: "fraction", numerator: "11", denominator: "12" },
  ]);
});

test("stacks 3/8 × 4/9 + 5/12 from a Math subject", () => {
  const input = "3/8 × 4/9 + 5/12";
  const pieces = mathDisplayPieces(input, { subject: "Math", category: "Fractions" });

  assert.ok(pieces);
  assert.equal(sourceText(pieces), input);
  assert.deepEqual(pieces, [
    { kind: "fraction", numerator: "3", denominator: "8" },
    { kind: "text", text: " × " },
    { kind: "fraction", numerator: "4", denominator: "9" },
    { kind: "text", text: " + " },
    { kind: "fraction", numerator: "5", denominator: "12" },
  ]);
});

test("stacks (2 1/4 - 7/8) × 4/11 from a Math subject", () => {
  const input = "(2 1/4 - 7/8) × 4/11";
  const pieces = mathDisplayPieces(input, { subject: "Math", category: "Fractions" });

  assert.ok(pieces);
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

test("a blank subject still uses a legacy Math or math category", () => {
  const input = "3/8 × 4/9 + 5/12";
  for (const category of ["Math", "math"]) {
    const pieces = mathDisplayPieces(input, { subject: " ", category });
    assert.ok(pieces);
    assert.equal(sourceText(pieces), input);
  }
  assert.equal(
    mathDisplayPieces(input, { subject: null, category: "Fractions" }),
    null,
  );
});

test("a non-Math question containing 1/2/2026 stays unchanged", () => {
  const stored = "Bring the form on 1/2/2026, and/or send it earlier.";
  const question = { subject: "Chinese", category: "Dates" };

  assert.equal(isMathQuestion(question), false);
  assert.equal(mathDisplayPieces(stored, question), null);
  assert.equal(stored, "Bring the form on 1/2/2026, and/or send it earlier.");
});
