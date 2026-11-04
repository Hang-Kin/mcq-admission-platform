import assert from "node:assert/strict";
import test from "node:test";

import { t } from "./index.ts";
import { results } from "./results.ts";
import { schedule } from "./schedule.ts";
import { session } from "./session.ts";
import { shell } from "./shell.ts";
import { students } from "./students.ts";

function leaves(tree: unknown, prefix: string): Array<[string, string]> {
  if (typeof tree === "string") return [[prefix, tree]];
  if (!tree || typeof tree !== "object") return [];
  return Object.entries(tree).flatMap(([key, value]) =>
    leaves(value, prefix ? `${prefix}.${key}` : key),
  );
}

test("language switch changes the shell strings", () => {
  assert.equal(t("shell.nav.home", "en"), "Home");
  assert.equal(t("shell.nav.home", "zh-Hant"), "主頁");
  assert.equal(t("shell.settings.title", "zh-Hant"), "設定");
  assert.equal(t("shell.settings.traditionalChinese", "en"), "繁體中文");
  assert.equal(t("shell.settings.traditionalChinese", "zh-Hant"), "繁體中文");
  assert.notEqual(t("shell.settings.colour", "en"), t("shell.settings.colour", "zh-Hant"));
  assert.notEqual(t("shell.nav.questions", "en"), t("shell.nav.questions", "zh-Hant"));
  assert.notEqual(t("shell.item.mathBank", "en"), t("shell.item.mathBank", "zh-Hant"));
  assert.notEqual(t("shell.group.subjectSettings", "en"), t("shell.group.subjectSettings", "zh-Hant"));
});

test("every dictionary key in English also exists in Chinese", () => {
  const catalogs = [
    ["shell", shell],
    ["schedule", schedule],
    ["results", results],
    ["students", students],
  ] as const;
  for (const [name, catalog] of catalogs) {
    const english = leaves(catalog.en, name);
    const chinese = new Map(leaves(catalog["zh-Hant"], name));
    assert.ok(english.length > 20, name);
    for (const [key, value] of english) {
      assert.equal(t(key, "en"), value, key);
      const translated = chinese.get(key);
      assert.equal(typeof translated, "string", key);
      assert.equal(t(key, "zh-Hant"), translated, key);
      assert.notEqual(translated?.trim(), "", key);
    }
  }
});

test("the student exam screen is still not translated", () => {
  assert.equal(leaves(session.en, "session").length, 0);
  assert.equal(t("session.start", "zh-Hant"), "session.start");
  assert.equal(t("missing", "en"), "missing");
});
