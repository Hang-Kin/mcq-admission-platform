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
import { contrastRatio, TEXT_CONTRAST_MINIMUM, textPairs, themeVariables } from "./theme.ts";

const saved = {
  locale: "zh-Hant" as const,
  theme: "contrast" as const,
  size: 175 as const,
};

test("theme and size values persist through cookie and storage", () => {
  const raw = serializePreferences(saved);
  assert.equal(raw, "zh-Hant.contrast.175");
  assert.deepEqual(parsePreferences(raw), saved);
  const header = preferenceCookie(raw, false);
  assert.match(header, /mcq-prefs=zh-Hant\.contrast\.175/);
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
  assert.equal(staff.theme, "contrast");
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

test("contrast values in both themes are at least 4.5:1", () => {
  for (const theme of ["normal", "contrast"] as const) {
    for (const pair of textPairs) {
      const ratio = contrastRatio(themeVariables[theme][pair.fg], themeVariables[theme][pair.bg]);
      assert.ok(
        ratio >= TEXT_CONTRAST_MINIMUM,
        `${theme} ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}`,
      );
    }
  }
});

test("globals.css uses the same theme tokens", () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../app/globals.css"), "utf8");
  const normal = css.slice(css.indexOf("/* theme-normal */"), css.indexOf("html[data-theme=\"contrast\"]"));
  const contrast = css.slice(css.indexOf("/* theme-contrast */"), css.indexOf(".dark"));
  for (const theme of ["normal", "contrast"] as const) {
    const block = theme === "normal" ? normal : contrast;
    for (const [name, value] of Object.entries(themeVariables[theme])) {
      assert.ok(block.includes(`--${name}: ${value};`), `${theme} --${name}`);
    }
  }
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
  const context = vm.createContext({
    location: { pathname },
    document: { documentElement: root, cookie },
    localStorage: { getItem: () => storage },
    decodeURIComponent,
  });
  vm.runInContext(preferenceBootScript(), context);
  return {
    theme: attrs.get("data-theme"),
    locale: attrs.get("data-locale"),
    shell: attrs.get("data-shell"),
    lang: root.lang,
    fontSize: root.style.fontSize,
  };
}

test("the boot script applies a saved theme and skips the exam", () => {
  const staff = runBoot("/admin", "mcq-prefs=zh-Hant.contrast.150", null);
  assert.deepEqual(staff, {
    theme: "contrast",
    locale: "zh-Hant",
    shell: "staff",
    lang: "zh-Hant",
    fontSize: "150%",
  });
  const fromStorage = runBoot("/", "", "en.contrast.200");
  assert.equal(fromStorage.theme, "contrast");
  assert.equal(fromStorage.fontSize, "200%");
  const exam = runBoot("/session/abc", "mcq-prefs=zh-Hant.contrast.150", "zh-Hant.contrast.150");
  assert.deepEqual(exam, {
    theme: "normal",
    locale: "en",
    shell: "exam",
    lang: "en",
    fontSize: "100%",
  });
});
