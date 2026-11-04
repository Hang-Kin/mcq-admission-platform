import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { phrase } from "./translate.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const appRoot = fileURLToPath(new URL("../../", import.meta.url));
const loaded = new Map<string, { exports: Record<string, unknown> }>();

function resolveSource(baseFile: string, spec: string): string | null {
  const target = spec.startsWith("@/")
    ? join(appRoot, spec.slice(2))
    : spec.startsWith(".")
      ? join(dirname(baseFile), spec)
      : null;
  if (!target) return null;
  for (const candidate of [`${target}.tsx`, `${target}.ts`, target]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function loadSource(filename: string): Record<string, unknown> {
  const cached = loaded.get(filename);
  if (cached) return cached.exports;
  const compiled = { exports: {} as Record<string, unknown> };
  loaded.set(filename, compiled);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      jsx: filename.endsWith(".tsx") ? ts.JsxEmit.ReactJSX : ts.JsxEmit.None,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (spec: string) => {
    const resolved = resolveSource(filename, spec);
    return resolved ? loadSource(resolved) : require(spec);
  };
  const run = new Function("require", "module", "exports", output) as (
    require: (spec: string) => unknown,
    compiledModule: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
  ) => void;
  run(localRequire, compiled, compiled.exports);
  return compiled.exports;
}

const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { QuestionTabs } = loadSource(fileURLToPath(new URL("./bank/QuestionTabs.tsx", import.meta.url))) as {
  QuestionTabs: (props: { settings: boolean }) => unknown;
};
const { ExportForm } = loadSource(fileURLToPath(new URL("./results/ExportForm.tsx", import.meta.url))) as {
  ExportForm: (props: {
    exams: Array<{ id: string; name: string }>;
    intakes: string[];
    intakeReady: boolean;
  }) => unknown;
};

test("the questions page shows English and Traditional Chinese", () => {
  const html = renderToStaticMarkup(createElement(QuestionTabs, { settings: false }));
  assert.match(html, /shell-en">Questions/);
  assert.match(html, /shell-zh">題目/);
  assert.match(html, /shell-en">Subject settings/);
  assert.match(html, /shell-zh">科目設定/);
  assert.equal(phrase("Questions", "en"), "Questions");
  assert.equal(phrase("Questions", "zh-Hant"), "題目");
});

test("the results export form shows English and Traditional Chinese", () => {
  const html = renderToStaticMarkup(
    createElement(ExportForm, {
      exams: [{ id: "exam-1", name: "May sitting" }],
      intakes: ["2026-10"],
      intakeReady: true,
    }),
  );
  assert.match(html, /shell-en">Exam</);
  assert.match(html, /shell-zh">考試</);
  assert.match(html, /shell-en">Export Excel</);
  assert.match(html, /shell-zh">匯出 Excel</);
  assert.match(html, /shell-en">Export CSV</);
  assert.match(html, /shell-zh">匯出 CSV</);
  assert.equal(phrase("Export Excel", "zh-Hant"), "匯出 Excel");
});
