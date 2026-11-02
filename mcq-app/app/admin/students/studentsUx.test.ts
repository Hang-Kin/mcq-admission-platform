import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

import { formatAddedAt } from "./addedAt.ts";
import { manualStudentInsert, parseManualStudent } from "./manualStudent.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
const loaded = new Map<string, { exports: Record<string, unknown> }>();
let linkPending = false;

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
    if (spec === "next/link") {
      const React = require("react") as typeof import("react");
      return {
        __esModule: true,
        useLinkStatus: () => ({ pending: linkPending }),
        default: function Link(props: { href?: string; children?: unknown }) {
          const { children, ...rest } = props;
          return React.createElement("a", rest, children);
        },
      };
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

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

test("a manual student can be saved with a Chinese name", () => {
  const parsed = parseManualStudent(
    formData({
      name: " Ada Lovelace ",
      chinese_name: " 陳大文 ",
      application_number: " 0101 ",
      intake_year: "2027",
      intake_month: "09",
    }),
  );
  assert.equal("error" in parsed, false);
  if ("error" in parsed) return;
  assert.deepEqual(manualStudentInsert(parsed), {
    name: "Ada Lovelace",
    chinese_name: "陳大文",
    application_number: "0101",
    intake: "2027-09",
  });
});

test("a manual student can be saved without a Chinese name", () => {
  const missing = parseManualStudent(
    formData({
      name: "Ada Lovelace",
      application_number: "1001",
      intake_year: "2026",
      intake_month: "10",
    }),
  );
  assert.equal("error" in missing, false);
  if ("error" in missing) return;
  assert.equal(manualStudentInsert(missing).chinese_name, null);

  const blank = parseManualStudent(
    formData({
      name: "Ada Lovelace",
      chinese_name: "   ",
      application_number: "1002",
      intake_year: "2026",
      intake_month: "10",
    }),
  );
  assert.equal("error" in blank, false);
  if ("error" in blank) return;
  assert.equal(blank.chineseName, null);
});

test("manual add still requires an intake and a four-digit 提交編號", () => {
  assert.deepEqual(
    parseManualStudent(
      formData({
        name: "Ada",
        application_number: "1001",
        intake_year: "",
        intake_month: "",
      }),
    ),
    { error: "Choose an intake." },
  );
  assert.deepEqual(
    parseManualStudent(
      formData({
        name: " ",
        application_number: "1001",
        intake_year: "2027",
        intake_month: "09",
      }),
    ),
    { error: "Full English name is required." },
  );
  assert.deepEqual(
    parseManualStudent(
      formData({
        name: "Ada",
        application_number: "100",
        intake_year: "2027",
        intake_month: "09",
      }),
    ),
    { error: "提交編號 must be 4 digits." },
  );
  assert.deepEqual(
    parseManualStudent(
      formData({
        name: "Ada",
        application_number: "1001.0",
        intake_year: "2027",
        intake_month: "09",
      }),
    ),
    { error: "提交編號 must be 4 digits." },
  );
});

test("roster times are shown in Hong Kong time", () => {
  assert.equal(formatAddedAt("2026-11-02T00:30:00.000Z"), "2 Nov 2026, 08:30");
  assert.equal(formatAddedAt("not-a-date"), "");
});

const dom = new Window({ url: "http://localhost:3000/admin/students" });
globalThis.window = dom as unknown as Window & typeof globalThis.window;
globalThis.document = dom.document;
globalThis.HTMLElement = dom.HTMLElement;
globalThis.Element = dom.Element as unknown as typeof Element;
globalThis.Node = dom.Node as unknown as typeof Node;
globalThis.DocumentFragment = dom.DocumentFragment as unknown as typeof DocumentFragment;
globalThis.MutationObserver = dom.MutationObserver;
globalThis.SVGElement = dom.SVGElement as unknown as typeof SVGElement;
globalThis.HTMLInputElement = dom.HTMLInputElement;
globalThis.HTMLSelectElement = dom.HTMLSelectElement;
globalThis.HTMLButtonElement = dom.HTMLButtonElement;
globalThis.HTMLFormElement = dom.HTMLFormElement;
globalThis.Event = dom.Event;
globalThis.InputEvent = dom.InputEvent;
globalThis.MouseEvent = dom.MouseEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NativeFormData = globalThis.FormData;
class DomAwareFormData extends NativeFormData {
  constructor(form?: unknown) {
    super();
    if (!form || typeof form !== "object" || !("elements" in form)) return;
    const elements = (
      form as {
        elements: ArrayLike<{
          name?: string;
          value?: string;
          type?: string;
          disabled?: boolean;
          checked?: boolean;
        }>;
      }
    ).elements;
    for (const element of Array.from(elements)) {
      if (!element?.name || element.disabled) continue;
      if ((element.type === "checkbox" || element.type === "radio") && !element.checked) continue;
      if (element.type === "file") continue;
      this.append(element.name, element.value ?? "");
    }
  }
}
globalThis.FormData = DomAwareFormData;
dom.FormData = DomAwareFormData;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const buttonModule = loadSource(fileURLToPath(new URL("../../../components/ui/button.tsx", import.meta.url))) as {
  Button: (props: Record<string, unknown>) => unknown;
  buttonVariants: (props?: Record<string, unknown>) => string;
};
const { StudentForm } = loadSource(fileURLToPath(new URL("./StudentForm.tsx", import.meta.url))) as {
  StudentForm: (props: { action: (formData: FormData) => Promise<{ error?: string } | void> }) => unknown;
};
const { IntakeFilterForm } = loadSource(fileURLToPath(new URL("./IntakeFilterForm.tsx", import.meta.url))) as {
  IntakeFilterForm: (props: { intakes: string[]; selectedIntake: string }) => unknown;
};
const { ImportStudentsLink } = loadSource(fileURLToPath(new URL("./ImportStudentsLink.tsx", import.meta.url))) as {
  ImportStudentsLink: () => unknown;
};

function setControl(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
}

test("action buttons scale down when pressed and grow only a little on hover", () => {
  const classes = buttonModule.buttonVariants();
  const hoverScale = Number(classes.match(/motion-safe:hover:scale-\[([0-9.]+)\]/)?.[1]);
  assert.equal(hoverScale, 1.02);
  assert.ok(hoverScale <= 1.05);
  assert.match(classes, /motion-safe:active:scale-\[0\.98\]/);
  assert.match(classes, /motion-reduce:transition-none/);
  assert.doesNotMatch(classes, /(?:^|\s)hover:scale-/);
  assert.doesNotMatch(classes, /(?:^|\s)active:scale-/);
});

test("a pending button is disabled and shows a spinner and Saving…", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        buttonModule.Button,
        { type: "submit", pending: true },
        "Save",
      ),
    );
  });
  const button = container.querySelector("button");
  assert.ok(button);
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute("aria-busy"), "true");
  assert.equal(button.textContent, "Saving…");
  assert.equal(button.querySelector("[data-pending-spinner]")?.getAttribute("aria-hidden"), "true");
  assert.match(button.querySelector("[data-pending-spinner]")?.getAttribute("class") ?? "", /motion-safe:animate-spin/);
  await act(async () => {
    root.render(createElement(buttonModule.Button, { type: "button", pendingLabel: "Adding…" }, "Add student"));
  });
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute("aria-busy"), null);
  assert.equal(button.textContent, "Add student");
  assert.equal(button.querySelector("[data-pending-spinner]"), null);
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("Import is the first and primary control on Students", async () => {
  const page = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
  const importAt = page.indexOf("<ImportStudentsLink");
  const filterAt = page.indexOf("<IntakeFilterForm");
  const addAt = page.indexOf("<StudentForm");
  assert.ok(importAt > 0);
  assert.ok(importAt < filterAt);
  assert.ok(importAt < addAt);

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  linkPending = false;
  await act(async () => {
    root.render(createElement(ImportStudentsLink));
  });
  const link = container.querySelector("a");
  assert.equal(link?.getAttribute("href"), "/admin/students/import");
  assert.equal(link?.textContent, "Import");
  assert.match(link?.className ?? "", /bg-primary/);
  assert.match(link?.className ?? "", /h-12/);
  linkPending = true;
  await act(async () => {
    root.render(createElement(ImportStudentsLink));
  });
  assert.equal(link?.textContent, "Opening…");
  assert.equal(link?.querySelector("[data-pending-spinner]")?.getAttribute("aria-hidden"), "true");
  await act(async () => {
    root.unmount();
  });
  container.remove();
  linkPending = false;
});

test("Show stays pending after the filter is submitted", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  container.addEventListener("submit", (event) => event.preventDefault());
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(IntakeFilterForm, { intakes: ["2027-09"], selectedIntake: "" }));
  });
  const button = container.querySelector("button");
  assert.equal(button?.textContent, "Show");
  await act(async () => {
    button?.click();
  });
  assert.equal(button?.textContent, "Showing…");
  assert.equal(button?.disabled, true);
  assert.equal(button?.getAttribute("aria-busy"), "true");
  assert.equal(container.querySelector("form")?.getAttribute("action"), "/admin/students");
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("Add student sends the Chinese name and shows Adding… while it saves", { timeout: 5000 }, async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const saved: FormData[] = [];
  let release: (value: { error?: string } | void) => void = () => {};
  const action = (formData: FormData) => {
    saved.push(formData);
    return new Promise<{ error?: string } | void>((resolve) => {
      release = resolve;
    });
  };

  await act(async () => {
    root.render(createElement(StudentForm, { action }));
  });

  const chinese = container.querySelector("#chinese_name");
  assert.ok(chinese instanceof HTMLInputElement);
  assert.equal(chinese.required, false);
  assert.equal(container.querySelector("#name") instanceof HTMLInputElement, true);
  assert.equal((container.querySelector("#name") as HTMLInputElement).required, true);

  await act(async () => {
    setControl(container.querySelector("#add-intake-year") as HTMLSelectElement, "2027");
    setControl(container.querySelector("#add-intake-month") as HTMLSelectElement, "09");
    setControl(container.querySelector("#name") as HTMLInputElement, "Ada Lovelace");
    setControl(chinese, "陳大文");
    setControl(container.querySelector("#application_number") as HTMLInputElement, "0101");
  });

  const button = container.querySelector("button");
  assert.equal(button?.textContent, "Add student");
  assert.match(button?.className ?? "", /border-input/);

  async function saveCurrentStudent() {
    const pendingSeen = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending state did not show")), 2000);
      const observer = new MutationObserver(() => {
        if (button?.textContent === "Adding…" && button.disabled) {
          clearTimeout(timeout);
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(container, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    const click = act(async () => {
      button?.click();
    });
    await pendingSeen;
    assert.equal(button?.querySelector("[data-pending-spinner]")?.getAttribute("aria-hidden"), "true");
    assert.equal(button?.getAttribute("aria-busy"), "true");
    await act(async () => {
      release();
    });
    await click;
  }

  await saveCurrentStudent();
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.get("name"), "Ada Lovelace");
  assert.equal(saved[0]?.get("chinese_name"), "陳大文");
  assert.equal(saved[0]?.get("application_number"), "0101");
  assert.equal(saved[0]?.get("intake_year"), "2027");
  assert.equal(saved[0]?.get("intake_month"), "09");
  assert.match(container.textContent ?? "", /Added Ada Lovelace \(0101\), 陳大文, 2027 September Entry/);
  assert.equal(button?.textContent, "Add student");
  assert.equal((container.querySelector("#chinese_name") as HTMLInputElement).value, "");

  await act(async () => {
    setControl(container.querySelector("#name") as HTMLInputElement, "Grace Hopper");
    setControl(container.querySelector("#application_number") as HTMLInputElement, "1008");
  });
  await saveCurrentStudent();
  assert.equal(saved[1]?.get("chinese_name"), "");
  assert.equal(saved[1]?.get("name"), "Grace Hopper");
  assert.match(container.textContent ?? "", /Added Grace Hopper \(1008\), 2027 September Entry/);
  assert.equal(container.textContent?.includes("陳大文"), false);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test.after(async () => {
  await dom.happyDOM.close();
});
