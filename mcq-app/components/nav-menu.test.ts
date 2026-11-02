import assert from "node:assert/strict";
import test from "node:test";

import { t } from "../lib/i18n/index.ts";
import { renderMenuOutline, staffNavMenu } from "./nav-menu.ts";

const REAL_PAGES = new Set([
  "/admin",
  "/admin/bank",
  "/admin/bank/Math",
  "/admin/bank/Chinese",
  "/admin/settings",
  "/admin/schedule",
  "/admin/schedule#codes",
  "/admin/exams",
  "/admin/exams/new",
  "/admin/students",
  "/admin/students/import",
  "/admin/review",
]);

test("menu config renders every group", () => {
  const outline = renderMenuOutline();
  assert.deepEqual(
    outline.map((section) => section.label),
    ["Home", "Questions", "Sittings", "Students", "Results"],
  );
  const questions = outline.find((section) => section.label === "Questions");
  assert.deepEqual(questions?.groups, [
    {
      label: "Questions",
      href: null,
      items: ["Math question bank", "Chinese question bank"],
    },
    {
      label: "Subject settings",
      href: "/admin/settings",
      items: [],
    },
  ]);
  for (const section of outline) {
    assert.ok(section.groups.length > 0, section.label);
    for (const group of section.groups) {
      assert.notEqual(group.label.trim(), "");
      assert.ok(group.href || group.items.length > 0, group.label);
    }
  }
});

test("every menu entry links to a real page and an English shell string", () => {
  for (const section of staffNavMenu) {
    assert.equal(t(section.labelKey, "en"), section.label);
    assert.notEqual(t(section.labelKey, "zh-Hant"), "");
    assert.ok(REAL_PAGES.has(section.href), section.href);
    for (const group of section.groups) {
      assert.equal(t(group.labelKey, "en"), group.label);
      if (group.href) assert.ok(REAL_PAGES.has(group.href), group.href);
      for (const item of group.items) {
        assert.equal(t(item.labelKey, "en"), item.label);
        assert.ok(REAL_PAGES.has(item.href), item.href);
      }
    }
  }
});
