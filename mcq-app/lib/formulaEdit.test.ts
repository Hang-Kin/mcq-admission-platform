import assert from "node:assert/strict";
import test from "node:test";

import { applyFormula, formulaAtCursor, pasteNeedsFormulaWarning } from "./formulaEdit.ts";

test("paste warning catches private-use and replacement characters", () => {
  assert.equal(pasteNeedsFormulaWarning("7 \uE000 4 \uF8FF 15 \uFFFD 3"), true);
  assert.equal(pasteNeedsFormulaWarning("7\uFFFD4"), true);
});

test("paste warning catches digits whose operators disappeared", () => {
  assert.equal(pasteNeedsFormulaWarning("7 4 15 3"), true);
  assert.equal(pasteNeedsFormulaWarning("Work out 7 4 15 3."), true);
});

test("plain text and Chinese paste are left alone", () => {
  assert.equal(pasteNeedsFormulaWarning("What is 2 + 2?"), false);
  assert.equal(pasteNeedsFormulaWarning("3/8 × 4/9 + 5/12"), false);
  assert.equal(pasteNeedsFormulaWarning("計算：一石二鳥。"), false);
  assert.equal(pasteNeedsFormulaWarning("Bring the form on 1/2/2026."), false);
  assert.equal(pasteNeedsFormulaWarning("7 4"), false);
});

test("a cursor inside a formula loads that formula", () => {
  const text = "Work out \\(7\\times 4\\).";
  const open = text.indexOf("\\(");
  const inside = formulaAtCursor(text, open + 4);
  assert.ok(inside);
  assert.equal(inside.latex, "7\\times 4");
  assert.equal(formulaAtCursor(text, 0), null);
  assert.equal(formulaAtCursor(text, text.length), null);
  assert.equal(formulaAtCursor("Work out \\(7", 12), null);
});

test("insert and edit write delimiters around the latex", () => {
  const inserted = applyFormula("Work out .", "Work out ".length, "Work out ".length, "7\\times 4");
  assert.equal(inserted.text, "Work out \\(7\\times 4\\).");

  const cursor = inserted.text.indexOf("7");
  const found = formulaAtCursor(inserted.text, cursor);
  assert.ok(found);
  const edited = applyFormula(inserted.text, cursor, cursor, "\\frac{15}{3}");
  assert.equal(edited.text, "Work out \\(\\frac{15}{3}\\).");
});
