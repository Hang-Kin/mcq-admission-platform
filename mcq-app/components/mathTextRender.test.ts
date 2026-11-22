import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const appRoot = fileURLToPath(new URL("../", import.meta.url));
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
    if (spec.endsWith(".css")) return {};
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
const { MathText } = loadSource(fileURLToPath(new URL("./MathText.tsx", import.meta.url))) as {
  MathText: (props: { text: string; subject?: string; category?: string }) => unknown;
};

test("plain text keeps a script tag escaped", () => {
  const html = renderToStaticMarkup(
    createElement(
      "p",
      null,
      createElement(MathText, { text: '<script>alert("x")</script>', subject: "Chinese" }),
    ),
  );
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
});

test("html beside a formula stays escaped and the formula is not raw latex", () => {
  const html = renderToStaticMarkup(
    createElement(MathText, {
      text: '<img src=x onerror=alert(1)> \\(1+1\\)',
      subject: "Math",
    }),
  );
  assert.equal(html.includes("<img"), false);
  assert.match(html, /&lt;img/);
  assert.equal(html.includes("\\(1+1\\)"), false);
  assert.match(html, /katex/);
});

test("a math question with no delimiters still stacks a fraction", () => {
  const html = renderToStaticMarkup(
    createElement(MathText, { text: "3/8 × 4", subject: "Math", category: "Fractions" }),
  );
  assert.match(html, /3/);
  assert.match(html, /8/);
  assert.equal(html.includes("katex"), false);
});

test("a non-math question with a date is not stacked", () => {
  const stored = "Bring the form on 1/2/2026.";
  const html = renderToStaticMarkup(
    createElement("p", null, createElement(MathText, { text: stored, subject: "Chinese" })),
  );
  assert.match(html, /1\/2\/2026/);
  assert.equal(html.includes("katex"), false);
});
