import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

import { staffNavVisible } from "./staff-nav.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const here = dirname(fileURLToPath(import.meta.url));

function loadTsx(filename: string): Record<string, unknown> {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiled = { exports: {} as Record<string, unknown> };
  const localRequire = (spec: string) => {
    if (spec === "./staff-nav" || spec === "./staff-nav.ts") {
      return { staffNavVisible };
    }
    return require(spec);
  };
  const run = new Function("require", "module", "exports", output) as (
    require: (spec: string) => unknown,
    compiledModule: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
  ) => void;
  run(localRequire, compiled, compiled.exports);
  return compiled.exports;
}

test("staff nav stays on admin paths and off the exam prefix", () => {
  assert.equal(staffNavVisible("/session/abc"), false);
  assert.equal(staffNavVisible("/session"), false);
  assert.equal(staffNavVisible("/session/"), false);
  assert.equal(staffNavVisible("/session/abc?x=1"), false);
  assert.equal(staffNavVisible("/admin"), true);
  assert.equal(staffNavVisible("/admin/settings"), true);
  assert.equal(staffNavVisible("/"), true);
  assert.equal(staffNavVisible("/auth/login"), true);
  assert.equal(staffNavVisible("/sessions"), true);
});

test("/session/abc renders no navbar and /admin still does", async () => {
  const dom = new Window({ url: "http://localhost:3000/session/abc" });
  globalThis.window = dom as unknown as Window & typeof globalThis.window;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.Element = dom.Element as unknown as typeof Element;
  globalThis.Node = dom.Node as unknown as typeof Node;
  globalThis.DocumentFragment = dom.DocumentFragment as unknown as typeof DocumentFragment;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const { createElement, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { StaffNavGate } = loadTsx(join(here, "staff-nav-gate.tsx")) as {
    StaffNavGate: (props: {
      pathname: string;
      nav?: unknown;
      children?: unknown;
    }) => unknown;
  };

  const nav = createElement(
    "header",
    { id: "site-header" },
    createElement("button", { type: "button" }, "Menu"),
    createElement("a", { href: "/admin/settings" }, "Settings"),
    createElement("a", { href: "/auth/login" }, "Sign in"),
    createElement("a", { href: "/admin" }, "Home"),
  );

  const host = dom.document.createElement("div");
  dom.document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(
      createElement(
        StaffNavGate,
        { pathname: "/session/abc", nav },
        "exam",
      ),
    );
  });

  assert.equal(host.querySelector("#site-header"), null);
  assert.equal(host.textContent?.includes("Settings"), false);
  assert.equal(host.textContent?.includes("Sign in"), false);
  assert.equal(host.querySelector('a[href="/auth/login"]'), null);
  assert.equal(host.querySelector('a[href="/admin"]'), null);
  assert.equal(host.querySelector('a[href="/admin/settings"]'), null);
  assert.match(host.textContent ?? "", /exam/);

  await act(async () => {
    root.render(
      createElement(StaffNavGate, { pathname: "/admin", nav }, "staff"),
    );
  });

  assert.ok(host.querySelector("#site-header"));
  assert.match(host.textContent ?? "", /Settings/);
  assert.match(host.textContent ?? "", /Sign in/);
  assert.ok(host.querySelector('a[href="/auth/login"]'));
  assert.ok(host.querySelector('a[href="/admin/settings"]'));

  await act(async () => {
    root.unmount();
  });
  dom.close();
});

test("session layout omits the staff navbar and admin layout keeps it", () => {
  const appRoot = join(here, "../app");
  const rootLayout = readFileSync(join(appRoot, "layout.tsx"), "utf8");
  const sessionLayout = readFileSync(join(appRoot, "session/layout.tsx"), "utf8");
  const adminLayout = readFileSync(join(appRoot, "admin/layout.tsx"), "utf8");
  assert.equal(rootLayout.includes("<Nav"), false);
  assert.equal(rootLayout.includes("SiteFrame"), false);
  assert.match(sessionLayout, /pathname="\/session"/);
  assert.equal(sessionLayout.includes("<Nav"), false);
  assert.match(adminLayout, /pathname="\/admin"/);
  assert.match(adminLayout, /SiteFrame/);
});
