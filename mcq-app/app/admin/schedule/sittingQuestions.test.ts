import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

import { groupDrawPreview, type PreviewGroup } from "./scheduleModel.ts";

function englishText(node: Element | null | undefined): string {
  if (!node) return "";
  const parts = [...node.querySelectorAll(".shell-en")];
  if (parts.length === 0) return node.textContent ?? "";
  return parts.map((part) => part.textContent ?? "").join("");
}

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
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

const dom = new Window({ url: "http://localhost:3000/" });
globalThis.window = dom as unknown as Window & typeof globalThis.window;
globalThis.document = dom.document;
globalThis.HTMLElement = dom.HTMLElement;
globalThis.Element = dom.Element as unknown as typeof Element;
globalThis.Node = dom.Node as unknown as typeof Node;
globalThis.DocumentFragment = dom.DocumentFragment as unknown as typeof DocumentFragment;
globalThis.MutationObserver = dom.MutationObserver;
globalThis.SVGElement = dom.SVGElement as unknown as typeof SVGElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { renderToStaticMarkup } = await import("react-dom/server");
const { SittingQuestions } = loadSource(fileURLToPath(new URL("./SittingQuestions.tsx", import.meta.url))) as {
  SittingQuestions: (props: { groups: PreviewGroup[] }) => unknown;
};

const slotOne = groupDrawPreview(
  [
    { subject: "Chinese", category: "成語", position: 2, questionText: "Second idiom" },
    { subject: "Chinese", category: "成語", position: 1, questionText: "First idiom" },
    { subject: "Math", category: "Fractions", position: 1, questionText: "Slot one fraction" },
  ],
  [],
);
const slotTwo = groupDrawPreview(
  [{ subject: "Math", category: "Decimals", position: 1, questionText: "Slot two decimal" }],
  [],
);

function slots() {
  return createElement(
    "div",
    null,
    createElement(SittingQuestions, { groups: slotOne }),
    createElement(SittingQuestions, { groups: slotTwo }),
  );
}

test("questions are left out of the first render", () => {
  const html = renderToStaticMarkup(slots());

  assert.equal(html.includes("First idiom"), false);
  assert.equal(html.includes("Second idiom"), false);
  assert.equal(html.includes("Slot one fraction"), false);
  assert.equal(html.includes("Slot two decimal"), false);
  assert.equal(html.includes("Hide questions"), false);
  assert.equal(html.match(/Show questions/g)?.length, 2);
  assert.equal(html.match(/aria-expanded="false"/g)?.length, 2);
  assert.equal(html.includes("Math 1 · Chinese 2"), true);
  assert.equal(html.includes(">Math 1<"), true);
  assert.equal(renderToStaticMarkup(createElement(SittingQuestions, { groups: [] })), "");
});

test("activating Show questions reveals only that slot", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(slots());
  });

  const buttons = [...container.querySelectorAll("button")];
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    assert.equal(button.tagName, "BUTTON");
    assert.equal(button.getAttribute("type"), "button");
    assert.equal(englishText(button), "Show questions");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(document.getElementById(button.getAttribute("aria-controls") ?? ""), null);
  }
  assert.equal(container.textContent?.includes("First idiom"), false);
  assert.equal(container.textContent?.includes("Slot one fraction"), false);
  assert.equal(container.textContent?.includes("Slot two decimal"), false);
  assert.equal(container.textContent?.includes("Math 1 · Chinese 2"), true);

  await act(async () => {
    buttons[0]?.click();
  });

  assert.equal(englishText(buttons[0]), "Hide questions");
  assert.equal(buttons[0]?.getAttribute("aria-expanded"), "true");
  assert.equal(englishText(buttons[1]), "Show questions");
  assert.equal(buttons[1]?.getAttribute("aria-expanded"), "false");
  const openPanel = document.getElementById(buttons[0]?.getAttribute("aria-controls") ?? "");
  assert.equal(openPanel?.textContent?.includes("Slot one fraction"), true);
  assert.equal(openPanel?.textContent?.includes("First idiom"), true);
  assert.equal(openPanel?.textContent?.includes("Second idiom"), true);
  assert.equal(openPanel?.textContent?.includes("成語"), true);
  assert.equal(container.textContent?.includes("Slot two decimal"), false);

  await act(async () => {
    buttons[1]?.click();
  });
  assert.equal(container.textContent?.includes("Slot two decimal"), true);
  assert.equal(container.textContent?.includes("Decimals"), true);
  assert.equal(buttons[0]?.getAttribute("aria-expanded"), "true");

  await act(async () => {
    buttons[0]?.click();
  });
  assert.equal(englishText(buttons[0]), "Show questions");
  assert.equal(buttons[0]?.getAttribute("aria-expanded"), "false");
  assert.equal(container.textContent?.includes("First idiom"), false);
  assert.equal(container.textContent?.includes("Slot one fraction"), false);
  assert.equal(container.textContent?.includes("Slot two decimal"), true);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test.after(async () => {
  await dom.happyDOM.close();
});
