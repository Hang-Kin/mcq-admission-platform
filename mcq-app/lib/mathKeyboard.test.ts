import assert from "node:assert/strict";
import test from "node:test";

import {
  classroomLayouts,
  classroomShortcuts,
  mathliveLocale,
  type KeyboardKey,
} from "./mathKeyboard.ts";

function latexOf(key: KeyboardKey): string {
  if (typeof key === "string") return key;
  return key.insert ?? key.latex ?? key.label ?? "";
}

test("classroom shortcuts map the requested keys and leave colon unmapped", () => {
  const shortcuts = classroomShortcuts({
    "*": "\\cdot",
    ":": "\\ratio",
    ":=": "\\coloneq",
    pi: "\\pi",
  });
  assert.equal(shortcuts["*"], "\\times");
  assert.equal(shortcuts.div, "\\div");
  assert.equal(shortcuts.sqrt, "\\sqrt{#?}");
  assert.equal(shortcuts["<="], "\\le");
  assert.equal(shortcuts[">="], "\\ge");
  assert.equal(shortcuts["!="], "\\ne");
  assert.equal(shortcuts.pi, "\\pi");
  assert.equal(":" in shortcuts, false);
  assert.equal(shortcuts[":="], "\\coloneq");
});

test("tab names come from the caller and the pads include the classroom keys", () => {
  const layouts = classroomLayouts({
    numeric: "123",
    functions: "f(x)",
    letters: "ABC",
    symbols: "符號",
  });
  assert.deepEqual(
    layouts.map((item) => item.label),
    ["123", "f(x)", "ABC", "符號"],
  );
  const keys = layouts.flatMap((item) => item.rows.flat().map(latexOf));
  for (const needed of ["\\times", "\\div", "\\frac{#@}{#?}", "\\sqrt{#0}", "\\le", "\\pi", "[return]"]) {
    assert.equal(keys.includes(needed), true, needed);
  }
  assert.equal(keys.includes(":"), false);
});

test("admin language picks a MathLive locale MathLive actually ships", () => {
  const supported = ["en", "zh-cn", "zh-tw"];
  assert.equal(mathliveLocale("en", supported), "en");
  assert.equal(mathliveLocale("zh-Hant", supported), "zh-tw");
  assert.equal(mathliveLocale("zh-Hant", ["en", "zh-hk", "zh-cn"]), "zh-hk");
  assert.equal(mathliveLocale("zh-Hant", ["en", "zh-cn"]), "zh-cn");
});
