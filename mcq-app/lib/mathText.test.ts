import assert from "node:assert/strict";
import test from "node:test";

import {
  joinMathText,
  latexToPlain,
  splitMathText,
  textToPlain,
} from "./mathText.ts";

test("a string with no math is unchanged", () => {
  for (const input of ["", "What is 2 + 2?", "成語：一石二鳥", "1/2/2026"]) {
    const segments = splitMathText(input);
    assert.equal(joinMathText(segments), input);
    if (input) assert.deepEqual(segments, [{ type: "text", value: input }]);
    else assert.deepEqual(segments, []);
    assert.equal(textToPlain(input), input);
  }
});

test("splitting and joining round-trips formulas", () => {
  const input = "Work out \\(7\\times 4-\\frac{15}{3}\\).";
  const segments = splitMathText(input);
  assert.deepEqual(segments, [
    { type: "text", value: "Work out " },
    { type: "math", value: "7\\times 4-\\frac{15}{3}" },
    { type: "text", value: "." },
  ]);
  assert.equal(joinMathText(segments), input);
});

test("an unclosed delimiter stays plain text", () => {
  const input = "Work out \\(7\\times 4";
  assert.deepEqual(splitMathText(input), [{ type: "text", value: input }]);
  assert.equal(joinMathText(splitMathText(input)), input);
  assert.equal(textToPlain(input), input);
});

test("Chinese text between formulas is untouched", () => {
  const input = "計算 \\(1+2\\) 和 \\(3\\)。";
  const segments = splitMathText(input);
  assert.deepEqual(segments, [
    { type: "text", value: "計算 " },
    { type: "math", value: "1+2" },
    { type: "text", value: " 和 " },
    { type: "math", value: "3" },
    { type: "text", value: "。" },
  ]);
  assert.equal(joinMathText(segments), input);
  assert.equal(textToPlain(input), "計算 1+2 和 3。");
});

test("latexToPlain covers the classroom symbols", () => {
  assert.equal(latexToPlain("\\frac{a}{b}"), "a/b");
  assert.equal(latexToPlain("\\frac{15}{3}"), "15/3");
  assert.equal(latexToPlain("\\times"), "×");
  assert.equal(latexToPlain("\\div"), "÷");
  assert.equal(latexToPlain("\\sqrt{x}"), "√x");
  assert.equal(latexToPlain("^{2}"), "^2");
  assert.equal(latexToPlain("x^{2}"), "x^2");
  assert.equal(latexToPlain("\\le"), "≤");
  assert.equal(latexToPlain("\\ge"), "≥");
  assert.equal(latexToPlain("\\ne"), "≠");
  assert.equal(latexToPlain("\\leq"), "≤");
  assert.equal(latexToPlain("\\geq"), "≥");
  assert.equal(latexToPlain("\\neq"), "≠");
});

test("textToPlain rewrites math segments only", () => {
  const input = "Work out \\(7\\times 4-\\frac{15}{3}\\).";
  assert.equal(textToPlain(input), "Work out 7× 4-15/3.");
  assert.equal(textToPlain("Keep \\times and 1/2 outside."), "Keep \\times and 1/2 outside.");
  assert.equal(
    textToPlain("\\(\\sqrt{x^{2}}\\le\\frac{1}{2}\\)"),
    "√x^2≤1/2",
  );
});
