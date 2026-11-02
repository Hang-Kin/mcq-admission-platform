import assert from "node:assert/strict";
import test from "node:test";

import { t } from "./index.ts";
import { shell } from "./shell.ts";

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

test("every shell string has both languages", () => {
  const english = leaves(shell.en, "shell");
  const chinese = new Map(leaves(shell["zh-Hant"], "shell"));
  assert.ok(english.length > 20);
  for (const [key, value] of english) {
    assert.equal(t(key, "en"), value);
    const translated = chinese.get(key);
    assert.equal(typeof translated, "string");
    assert.equal(t(key, "zh-Hant"), translated);
    assert.notEqual(translated?.trim(), "");
  }
});

test("other areas stay empty until a later wave", () => {
  assert.equal(t("schedule.sitting", "en"), "schedule.sitting");
  assert.equal(t("results.export", "zh-Hant"), "results.export");
  assert.equal(t("students.import", "en"), "students.import");
  assert.equal(t("session.start", "zh-Hant"), "session.start");
  assert.equal(t("missing", "en"), "missing");
});
