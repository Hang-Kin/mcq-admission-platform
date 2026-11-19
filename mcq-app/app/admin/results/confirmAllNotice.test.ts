import assert from "node:assert/strict";
import test from "node:test";

import { phrase } from "../translate.ts";
import { labels } from "./labels.ts";
import { readRpc } from "./markRpc.ts";

test("confirm all says how many answers were confirmed and how many had no mark", () => {
  const text = labels.confirmAllResult(4, 2);
  assert.equal(
    text,
    "4 confirmed, 2 skipped because they have no mark. A person must mark those.",
  );
  const chinese = phrase(text, "zh-Hant");
  assert.match(chinese, /已確認 4 項/);
  assert.match(chinese, /略過 2 項/);
  assert.equal(chinese.includes("confirmed"), false);
  assert.equal(chinese.includes("skipped"), false);
});

test("the confirm-all result keeps a skipped count, including zero when the database omits it", () => {
  const result = readRpc({
    ok: true,
    confirmed: 4,
    changed: 0,
    preserved: 0,
    skipped: 2,
  });
  assert.deepEqual(result, {
    ok: true,
    confirmed: 4,
    changed: 0,
    preserved: 0,
    skipped: 2,
  });
  const omitted = readRpc({ ok: true, confirmed: 1 });
  assert.equal(omitted.ok && omitted.skipped, 0);
});

test("confirm on an ungraded answer maps to a clear mark-first message", () => {
  const result = readRpc({ ok: false, error: "ungraded" });
  assert.deepEqual(result, { ok: false, code: "ungraded" });
  assert.equal(
    labels.ungradedConfirm,
    "This answer has no mark yet. Mark it correct or incorrect first.",
  );
  const chinese = phrase(labels.ungradedConfirm, "zh-Hant");
  assert.equal(chinese, "此答案尚未有評分。請先選擇正確或不正確。");
  assert.equal(chinese.includes("permission"), false);
});
