import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { preferenceBootScript } from "./boot.ts";
import {
  DEFAULT_PREFERENCES,
  documentPreferenceState,
  parsePreferences,
  preferenceCookie,
  preferencesFromSources,
  readCookieValue,
  serializePreferences,
  UI_SIZES,
  viewPreferences,
} from "./preferences.ts";
import {
  CONTROL_CONTRAST_MINIMUM,
  contrastRatio,
  controlPairs,
  HIGH_CONTRAST_TEXT_MINIMUM,
  highContrastTextPairs,
  TEXT_CONTRAST_MINIMUM,
  textPairs,
  themeVariables,
} from "./theme.ts";

const saved = {
  locale: "zh-Hant" as const,
  theme: "dark" as const,
  size: 175 as const,
};

test("theme and size values persist through cookie and storage", () => {
  const raw = serializePreferences(saved);
  assert.equal(raw, "zh-Hant.dark.175");
  assert.deepEqual(parsePreferences(raw), saved);
  assert.deepEqual(parsePreferences("en.light-contrast.50"), {
    locale: "en",
    theme: "light-contrast",
    size: 50,
  });
  const header = preferenceCookie(raw, false);
  assert.match(header, /mcq-prefs=zh-Hant\.dark\.175/);
  assert.match(header, /Max-Age=/);
  assert.match(header, /SameSite=Lax/);
  assert.equal(readCookieValue(`theme=dark; ${header.split(";")[0]}`), raw);
  assert.deepEqual(preferencesFromSources({ cookie: raw, storage: "en.normal.50" }), saved);
  assert.deepEqual(
    preferencesFromSources({ cookie: "broken", storage: serializePreferences(saved) }),
    saved,
  );
  assert.deepEqual(preferencesFromSources({ cookie: null, storage: null }), DEFAULT_PREFERENCES);
  for (const size of UI_SIZES) {
    assert.deepEqual(parsePreferences(`en.normal.${size}`)?.size, size);
  }
  assert.equal(parsePreferences("en.normal.80"), null);
  assert.equal(parsePreferences("fr.contrast.100"), null);
});

test("the exam screen keeps the default theme and size", () => {
  const staff = documentPreferenceState(saved, "/admin/bank");
  assert.equal(staff.theme, "dark");
  assert.equal(staff.locale, "zh-Hant");
  assert.equal(staff.fontSize, "175%");
  assert.equal(staff.shell, "staff");
  assert.equal(staff.lang, "zh-Hant");
  const exam = documentPreferenceState(saved, "/session/token");
  assert.deepEqual(viewPreferences(saved, "/session/token"), DEFAULT_PREFERENCES);
  assert.equal(exam.theme, "normal");
  assert.equal(exam.locale, "en");
  assert.equal(exam.fontSize, "100%");
  assert.equal(exam.shell, "exam");
  assert.equal(exam.lang, "en");
});

test("normal text stays at least 4.5:1 and the menu border is at least 3:1", () => {
  for (const pair of textPairs) {
    const ratio = contrastRatio(themeVariables.normal[pair.fg], themeVariables.normal[pair.bg]);
    assert.ok(ratio >= TEXT_CONTRAST_MINIMUM, `normal ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}`);
  }
  const menu = contrastRatio(themeVariables.normal["menu-border"], themeVariables.normal.background);
  assert.ok(menu >= CONTROL_CONTRAST_MINIMUM, `normal menu border is ${menu.toFixed(2)}`);
});

test("dark and light high contrast text is at least 7:1 and controls are at least 3:1", () => {
  for (const theme of ["dark", "light-contrast"] as const) {
    for (const pair of highContrastTextPairs) {
      const ratio = contrastRatio(themeVariables[theme][pair.fg], themeVariables[theme][pair.bg]);
      assert.ok(
        ratio >= HIGH_CONTRAST_TEXT_MINIMUM,
        `${theme} ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}`,
      );
    }
    for (const pair of controlPairs) {
      const ratio = contrastRatio(themeVariables[theme][pair.fg], themeVariables[theme][pair.bg]);
      assert.ok(
        ratio >= CONTROL_CONTRAST_MINIMUM,
        `${theme} ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}`,
      );
    }
  }
});

test("globals.css uses the same theme tokens", () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../app/globals.css"), "utf8");
  for (const theme of ["normal", "dark", "light-contrast"] as const) {
    const start = css.indexOf(`/* theme-${theme} */`);
    const end = css.indexOf(`/* end-theme-${theme} */`);
    assert.ok(start >= 0 && end > start, theme);
    const block = css.slice(start, end);
    for (const [name, value] of Object.entries(themeVariables[theme])) {
      assert.ok(block.includes(`--${name}: ${value};`), `${theme} --${name}`);
    }
  }
  assert.equal(css.includes('html[data-theme="contrast"]'), false);
});

function runBoot(pathname: string, cookie: string, storage: string | null) {
  const attrs = new Map<string, string>();
  const root = {
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    lang: "en",
    style: { fontSize: "" },
  };
  const writes: { cookie: string | null; storage: string | null } = { cookie: null, storage: null };
  let cookieHeader = cookie;
  const context = vm.createContext({
    location: { pathname, protocol: "http:" },
    document: {
      documentElement: root,
      get cookie() {
        return cookieHeader;
      },
      set cookie(value: string) {
        writes.cookie = value;
        cookieHeader = value;
      },
    },
    localStorage: {
      getItem: () => storage,
      setItem: (_key: string, value: string) => {
        writes.storage = value;
      },
    },
    decodeURIComponent,
    encodeURIComponent,
  });
  vm.runInContext(preferenceBootScript(), context);
  return {
    theme: attrs.get("data-theme"),
    locale: attrs.get("data-locale"),
    shell: attrs.get("data-shell"),
    lang: root.lang,
    fontSize: root.style.fontSize,
    writes,
  };
}

test("the boot script applies a saved theme and skips the exam", () => {
  const staff = runBoot("/admin", "mcq-prefs=zh-Hant.dark.150", null);
  assert.deepEqual(staff.theme, "dark");
  assert.equal(staff.locale, "zh-Hant");
  assert.equal(staff.shell, "staff");
  assert.equal(staff.lang, "zh-Hant");
  assert.equal(staff.fontSize, "150%");
  assert.equal(staff.writes.cookie, null);
  const light = runBoot("/", "", "en.light-contrast.125");
  assert.equal(light.theme, "light-contrast");
  assert.equal(light.fontSize, "125%");
  const exam = runBoot("/session/abc", "mcq-prefs=zh-Hant.dark.150", "zh-Hant.dark.150");
  assert.deepEqual(
    { theme: exam.theme, locale: exam.locale, shell: exam.shell, lang: exam.lang, fontSize: exam.fontSize },
    {
      theme: "normal",
      locale: "en",
      shell: "exam",
      lang: "en",
      fontSize: "100%",
    },
  );
});

test("an old contrast value maps to dark with no error", () => {
  const legacy = {
    locale: "zh-Hant" as const,
    theme: "dark" as const,
    size: 150 as const,
  };
  assert.deepEqual(parsePreferences("zh-Hant.contrast.150"), legacy);
  assert.deepEqual(parsePreferences("en.contrast.200"), {
    locale: "en",
    theme: "dark",
    size: 200,
  });
  assert.equal(parsePreferences("en.contrast.80"), null);
  assert.deepEqual(
    preferencesFromSources({ cookie: "zh-Hant.contrast.150", storage: "en.normal.100" }),
    legacy,
  );
  const fromCookie = runBoot("/admin/schedule", "mcq-prefs=zh-Hant.contrast.150", null);
  assert.equal(fromCookie.theme, "dark");
  assert.equal(fromCookie.locale, "zh-Hant");
  assert.equal(fromCookie.fontSize, "150%");
  assert.equal(fromCookie.writes.storage, "zh-Hant.dark.150");
  assert.match(fromCookie.writes.cookie ?? "", /mcq-prefs=zh-Hant\.dark\.150/);
  assert.match(fromCookie.writes.cookie ?? "", /Max-Age=/);
  assert.match(fromCookie.writes.cookie ?? "", /SameSite=Lax/);
  const fromStorage = runBoot("/admin/students", "", "en.contrast.200");
  assert.equal(fromStorage.theme, "dark");
  assert.equal(fromStorage.fontSize, "200%");
  assert.equal(fromStorage.writes.storage, "en.dark.200");
  const exam = runBoot("/session/abc", "mcq-prefs=zh-Hant.contrast.150", "zh-Hant.contrast.150");
  assert.equal(exam.theme, "normal");
  assert.equal(exam.writes.cookie, null);
  assert.equal(exam.writes.storage, null);
});
