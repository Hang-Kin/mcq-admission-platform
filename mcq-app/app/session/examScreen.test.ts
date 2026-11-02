import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

import {
  canFinishSection,
  canSubmitExam,
  unansweredCount,
} from "./[token]/examProgress.ts";
import {
  finishSectionButtonLabel,
  finishSectionConfirmCopy,
  unansweredCountLabel,
} from "./[token]/labels.js";

const questions = [
  {
    id: "q1",
    question_text: "What is 1/2 of 8?",
    type: "radio",
    options: ["2", "4", "6"],
    category: "Fractions",
    subject: "Math",
    question_set: "Algebra",
  },
  {
    id: "q2",
    question_text: "第二題：下列哪一句成語用法正確？請選擇最合適的答案，句子要能完整換行。",
    type: "radio",
    options: ["一石二鳥", "畫蛇添足"],
    category: "成語",
    subject: "Chinese",
    question_set: "Chinese",
  },
  {
    id: "q3",
    question_text: "Write a short answer.",
    type: "text",
    options: [],
    category: "Writing",
    subject: "English",
    question_set: "English",
  },
];

const sectionA = {
  id: "sec-a",
  label: "Section A",
  index: 0,
  position: 0,
  questionSet: "Algebra",
  endsAtMs: 1,
  isLast: false,
};

const sectionB = { ...sectionA, id: "sec-b", label: "Section B", index: 1, position: 1, isLast: true };

test("unanswered questions ignore blanks and keep a real zero", () => {
  assert.equal(
    unansweredCount(questions, { q1: "4", q2: "   ", q3: "" }),
    2,
  );
  assert.equal(unansweredCount(questions, { q1: "0", q2: "一石二鳥", q3: "done" }), 0);
  assert.equal(unansweredCountLabel(0), null);
  assert.equal(unansweredCountLabel(1), "1 question is not answered");
  assert.equal(unansweredCountLabel(2), "2 questions are not answered");
});

test("finish and submit stay hidden until the last question", () => {
  assert.equal(canFinishSection(0, 3, true), false);
  assert.equal(canFinishSection(1, 3, true), false);
  assert.equal(canFinishSection(2, 3, true), true);
  assert.equal(canFinishSection(2, 3, false), false);
  assert.equal(canSubmitExam(0, 3, false), false);
  assert.equal(canSubmitExam(2, 3, false), true);
  assert.equal(canSubmitExam(2, 3, true), false);
  assert.equal(finishSectionButtonLabel("Section A"), "Finish Section A");
  assert.equal(finishSectionButtonLabel("Section B"), "Finish Section B");
  assert.equal(finishSectionConfirmCopy(), "You cannot return to this section. Finish now?");
});

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

const dom = new Window({ url: "http://localhost:3000/" });
globalThis.window = dom as unknown as Window & typeof globalThis.window;
globalThis.document = dom.document;
globalThis.HTMLElement = dom.HTMLElement;
globalThis.Element = dom.Element as unknown as typeof Element;
globalThis.Node = dom.Node as unknown as typeof Node;
globalThis.DocumentFragment = dom.DocumentFragment as unknown as typeof DocumentFragment;
globalThis.MutationObserver = dom.MutationObserver;
globalThis.SVGElement = dom.SVGElement as unknown as typeof SVGElement;
globalThis.HTMLInputElement = dom.HTMLInputElement;
globalThis.HTMLButtonElement = dom.HTMLButtonElement;
globalThis.HTMLTextAreaElement = dom.HTMLTextAreaElement;
globalThis.HTMLLabelElement = dom.HTMLLabelElement;
globalThis.HTMLImageElement = dom.HTMLImageElement;
globalThis.Event = dom.Event;
globalThis.MouseEvent = dom.MouseEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, useState, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { ExamChrome } = loadSource(
  fileURLToPath(new URL("./[token]/ExamChrome.tsx", import.meta.url)),
) as {
  ExamChrome: (props: Record<string, unknown>) => unknown;
};

function buttonText(button: Element) {
  return (button.textContent ?? "").replace(/\s+/g, " ").trim();
}

function buttons(root: ParentNode) {
  return Array.from(root.querySelectorAll("button"));
}

function buttonByText(root: ParentNode, label: string) {
  return buttons(root).find((button) => buttonText(button) === label) ?? null;
}

function labels(root: ParentNode) {
  return buttons(root).map((button) => buttonText(button));
}

type HarnessOptions = {
  section: typeof sectionA | null;
  answers: Record<string, string>;
  onConfirmFinish?: () => void;
  onConfirmSubmit?: () => void;
};

function Harness(options: HarnessOptions) {
  const [index, setIndex] = useState(0);
  const [finishOpen, setFinishOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  return createElement(ExamChrome, {
    questions,
    index,
    answers: options.answers,
    section: options.section,
    remainingLabel: "12:00",
    autosaveLabel: "Saved",
    sectionNotice: null,
    advanceBusy: false,
    submitBusy: false,
    finishConfirmOpen: finishOpen,
    submitConfirmOpen: submitOpen,
    fraction: null,
    onSelectQuestion: setIndex,
    onPrevious: () => setIndex((current) => Math.max(0, current - 1)),
    onNext: () => setIndex((current) => Math.min(questions.length - 1, current + 1)),
    onAnswer: () => {},
    onFractionPart: () => {},
    onOpenFinish: () => setFinishOpen(true),
    onOpenSubmit: () => setSubmitOpen(true),
    onCancelFinish: () => setFinishOpen(false),
    onCancelSubmit: () => setSubmitOpen(false),
    onConfirmFinish: () => options.onConfirmFinish?.(),
    onConfirmSubmit: () => options.onConfirmSubmit?.(),
  });
}

async function mount(options: HarnessOptions) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(Harness, options));
  });
  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function click(root: ParentNode, label: string) {
  const button = buttonByText(root, label);
  assert.ok(button, `missing button ${label}`);
  await act(async () => {
    button.click();
  });
}

test("earlier questions hide Finish and the last question asks before finishing", async () => {
  let confirmed = 0;
  const view = await mount({
    section: sectionA,
    answers: { q1: "4" },
    onConfirmFinish: () => {
      confirmed += 1;
    },
  });

  assert.equal(labels(view.container).includes("Finish Section A"), false);
  assert.equal(labels(view.container).includes("Submit exam"), false);
  assert.equal(view.container.querySelector("[role='dialog']"), null);
  assert.ok(buttonByText(view.container, "Previous"));
  assert.ok(buttonByText(view.container, "Next"));

  await click(view.container, "2");
  assert.equal(labels(view.container).includes("Finish Section A"), false);

  await click(view.container, "3");
  assert.equal(labels(view.container).includes("Finish Section A"), true);
  const previous = buttonByText(view.container, "Previous");
  assert.match(previous?.className ?? "", /min-h-11/);

  await click(view.container, "Finish Section A");
  const dialog = view.container.querySelector("[role='dialog']");
  assert.ok(dialog);
  const dialogText = dialog.textContent ?? "";
  assert.match(dialogText, /You cannot return to this section\. Finish now\?/);
  assert.match(dialogText, /2 questions are not answered/);
  assert.doesNotMatch(dialogText, /This submits the exam/);

  await click(dialog, "Cancel");
  assert.equal(view.container.querySelector("[role='dialog']"), null);
  assert.equal(confirmed, 0);

  await click(view.container, "Finish Section A");
  const again = view.container.querySelector("[role='dialog']");
  assert.ok(again);
  await click(again, "Finish now");
  assert.equal(confirmed, 1);
  await view.unmount();
});

test("a finished section with every answer omits the unanswered count", async () => {
  const view = await mount({
    section: sectionB,
    answers: { q1: "4", q2: "一石二鳥", q3: "done" },
  });
  await click(view.container, "3");
  await click(view.container, "Finish Section B");
  const dialog = view.container.querySelector("[role='dialog']");
  assert.ok(dialog);
  const dialogText = dialog.textContent ?? "";
  assert.match(dialogText, /You cannot return to this section\. Finish now\?/);
  assert.match(dialogText, /This submits the exam/);
  assert.doesNotMatch(dialogText, /not answered/);
  await view.unmount();
});

test("final submit is only on the last question and counts blanks", async () => {
  let submitted = 0;
  const view = await mount({
    section: null,
    answers: { q2: "一石二鳥" },
    onConfirmSubmit: () => {
      submitted += 1;
    },
  });
  assert.equal(labels(view.container).includes("Submit exam"), false);
  assert.equal(labels(view.container).includes("Finish Section A"), false);
  await click(view.container, "Next");
  assert.equal(labels(view.container).includes("Submit exam"), false);
  await click(view.container, "3");
  assert.equal(labels(view.container).includes("Submit exam"), true);
  await click(view.container, "Submit exam");
  const dialog = view.container.querySelector("[role='dialog']");
  assert.ok(dialog);
  const dialogText = dialog.textContent ?? "";
  assert.match(dialogText, /You cannot change your answers after submitting\. Submit now\?/);
  assert.match(dialogText, /2 questions are not answered/);
  await click(dialog, "Cancel");
  assert.equal(submitted, 0);
  assert.equal(view.container.querySelector("[role='dialog']"), null);
  await click(view.container, "Submit exam");
  const again = view.container.querySelector("[role='dialog']");
  assert.ok(again);
  await click(again, "Submit now");
  assert.equal(submitted, 1);
  await view.unmount();
});
