import assert from "node:assert/strict";
import test from "node:test";

import {
  formatHongKongDateTime,
  formatHongKongRange,
  parseHongKongDateTime,
} from "./hongKongTime.ts";

test("1:46 pm with no zone is Hong Kong time, not UTC", () => {
  const ms = parseHongKongDateTime("2026-11-02T13:46");
  assert.equal(ms, Date.parse("2026-11-02T05:46:00.000Z"));
  assert.equal(formatHongKongDateTime("2026-11-02T13:46"), "2 Nov 2026, 13:46 HKT");
  // Reading that same wall clock as UTC is what showed 9:46 pm in Hong Kong.
  assert.equal(formatHongKongDateTime("2026-11-02T13:46:00.000Z"), "2 Nov 2026, 21:46 HKT");
});

test("a time just after midnight stays on the Hong Kong date", () => {
  const ms = parseHongKongDateTime("2026-11-02T00:10");
  assert.equal(ms, Date.parse("2026-11-01T16:10:00.000Z"));
  assert.equal(formatHongKongDateTime("2026-11-02T00:10"), "2 Nov 2026, 00:10 HKT");
  assert.equal(
    formatHongKongRange("2026-11-02T00:10", "2026-11-02T00:26"),
    "2 Nov 2026, 00:10–00:26 HKT",
  );
});

test("a value that already has a zone is left as that instant", () => {
  assert.equal(
    parseHongKongDateTime("2026-11-02T13:46:00+08:00"),
    Date.parse("2026-11-02T05:46:00.000Z"),
  );
  assert.equal(
    parseHongKongDateTime("2026-11-02T05:46:00.000Z"),
    Date.parse("2026-11-02T05:46:00.000Z"),
  );
  assert.equal(parseHongKongDateTime("not-a-time"), null);
  assert.equal(parseHongKongDateTime("2026-02-31T13:46"), null);
});
