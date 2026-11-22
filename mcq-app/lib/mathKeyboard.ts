export type KeyboardKey =
  | string
  | {
      latex?: string;
      insert?: string;
      label?: string;
      class?: string;
      shift?: { label?: string; latex?: string };
    };

export type KeyboardLayout = {
  id: string;
  label: string;
  tooltip: string;
  displayEditToolbar: false;
  rows: KeyboardKey[][];
};

export type KeyboardTabLabels = {
  numeric: string;
  functions: string;
  letters: string;
  symbols: string;
};

const SHORTCUT_OVERRIDES: Record<string, string> = {
  "*": "\\times",
  div: "\\div",
  sqrt: "\\sqrt{#?}",
  "<=": "\\le",
  ">=": "\\ge",
  "!=": "\\ne",
  pi: "\\pi",
};

/** `/` stays MathLive's fraction key. `:` is not a shortcut. */
export function classroomShortcuts<T extends Record<string, unknown>>(defaults: T): T {
  const next = { ...defaults };
  delete next[":"];
  return { ...next, ...SHORTCUT_OVERRIDES };
}

/**
 * MathLive 0.111 ships en, zh-cn, and zh-tw. It does not ship zh-hk.
 * Traditional Chinese admin copy uses zh-tw. zh-cn is the last fallback.
 */
export function mathliveLocale(admin: "en" | "zh-Hant", supported: readonly string[]): string {
  if (admin !== "zh-Hant") return "en";
  if (supported.includes("zh-hk")) return "zh-hk";
  if (supported.includes("zh-tw")) return "zh-tw";
  return "zh-cn";
}

function letter(char: string): KeyboardKey {
  return {
    label: char,
    class: "hide-shift",
    shift: { label: char.toUpperCase() },
  };
}

function letters(word: string): KeyboardKey[] {
  return [...word].map((char) => letter(char));
}

function layout(
  id: string,
  label: string,
  rows: KeyboardKey[][],
): KeyboardLayout {
  return {
    id,
    label,
    tooltip: label,
    displayEditToolbar: false,
    rows,
  };
}

export function classroomLayouts(labels: KeyboardTabLabels): KeyboardLayout[] {
  return [
    layout(labels.numeric, labels.numeric, [
      ["7", "8", "9", { latex: "\\times" }, { latex: "\\div" }],
      ["4", "5", "6", { latex: "+" }, { latex: "-" }],
      ["1", "2", "3", { latex: "=" }],
      ["0", { latex: "." }, "[backspace]", "[left]", "[right]", "[return]"],
    ]),
    layout(labels.functions, labels.functions, [
      [
        { insert: "\\frac{#@}{#?}", latex: "\\frac{a}{b}" },
        { insert: "#@^{2}", latex: "x^{2}" },
        { insert: "#@^{#?}", latex: "x^{n}" },
        { latex: "\\sqrt{#0}" },
        { insert: "\\left|#0\\right|", latex: "\\left|x\\right|" },
        { insert: "\\overline{#0}", latex: "\\overline{x}" },
      ],
      [
        { insert: "\\left(#0\\right)", latex: "\\left(x\\right)" },
        { latex: "(" },
        { latex: ")" },
        { latex: "x" },
        { latex: "y" },
      ],
    ]),
    layout(labels.letters, labels.letters, [
      letters("qwertyuiop"),
      letters("asdfghjkl"),
      ["[shift]", ...letters("zxcvbnm"), "[backspace]"],
      ["[left]", "[right]"],
    ]),
    layout(labels.symbols, labels.symbols, [
      [
        { latex: "<" },
        { latex: ">" },
        { latex: "\\le" },
        { latex: "\\ge" },
        { latex: "\\ne" },
      ],
      [
        { latex: "\\pi" },
        { latex: "e" },
        { latex: "x" },
        { latex: "y" },
        { insert: "^{\\circ}", latex: "^\\circ" },
        { latex: "\\%" },
      ],
    ]),
  ];
}
