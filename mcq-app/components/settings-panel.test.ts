import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

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
  for (const candidate of [
    `${target}.tsx`,
    `${target}.ts`,
    join(target, "index.tsx"),
    join(target, "index.ts"),
    target,
  ]) {
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
    if (spec === "next/navigation") {
      return { useRouter: () => ({ push() {}, refresh() {} }), usePathname: () => "/admin" };
    }
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

const dom = new Window({ url: "http://localhost:3000/admin" });
const domWindow = dom as unknown as Window & typeof globalThis;
globalThis.window = domWindow;
globalThis.document = dom.document;
globalThis.HTMLElement = dom.HTMLElement;
globalThis.Element = dom.Element as unknown as typeof Element;
globalThis.Node = dom.Node as unknown as typeof Node;
globalThis.DocumentFragment = dom.DocumentFragment as unknown as typeof DocumentFragment;
globalThis.MutationObserver = dom.MutationObserver;
globalThis.SVGElement = dom.SVGElement as unknown as typeof SVGElement;
globalThis.HTMLButtonElement = dom.HTMLButtonElement;
globalThis.Event = dom.Event;
globalThis.KeyboardEvent = dom.KeyboardEvent;
globalThis.MouseEvent = dom.MouseEvent;
globalThis.PointerEvent = dom.PointerEvent;
globalThis.getComputedStyle = dom.getComputedStyle.bind(dom);
globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
  callback(0);
  return 1;
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, "navigator", { value: dom.navigator, configurable: true });

window.matchMedia = ((query: string) => ({
  matches: query.includes("hover") || query.includes("fine"),
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return false;
  },
})) as unknown as typeof window.matchMedia;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { SettingsPanel } = loadSource(fileURLToPath(new URL("./settings-panel.tsx", import.meta.url))) as {
  SettingsPanel: (props: { closeToken: number; onOpen: () => void }) => unknown;
};

function panel() {
  return document.getElementById("settings-panel");
}

function pointer(type: "mouseover" | "mouseout", target: HTMLElement) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget: document.body }));
}

async function hoverCycle(button: HTMLButtonElement, region: HTMLElement) {
  await act(async () => {
    pointer("mouseout", region);
    pointer("mouseover", button);
  });
  assert.ok(panel(), "hover should open settings");
  await act(async () => {
    pointer("mouseout", region);
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  assert.equal(panel(), null, "leaving should close settings");
  await act(async () => {
    pointer("mouseover", button);
  });
  assert.ok(panel(), "hover should open settings again");
}

test("Escape closes settings on the second hover open", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(SettingsPanel, { closeToken: 0, onOpen() {} }));
  });

  const button = container.querySelector("button");
  const region = button?.parentElement;
  assert.ok(button);
  assert.ok(region);

  await hoverCycle(button, region);
  await act(async () => {
    button.focus();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    pointer("mouseover", button);
  });
  assert.equal(panel(), null, "Escape stays closed when the panel was under the pointer");

  await hoverCycle(button, region);
  await act(async () => {
    button.focus();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  assert.equal(panel(), null, "Escape should close the panel the second time as well");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
