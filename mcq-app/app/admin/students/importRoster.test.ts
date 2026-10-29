import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyRosterRows,
  formatImportSummary,
  mapRosterSheet,
  normalizeImportRows,
  rowsToInsert,
  tallyRoster,
} from "./importRoster.ts";

test("summary uses the staff sentence", () => {
  assert.equal(
    formatImportSummary({ added: 42, alreadyThere: 3, errors: 1 }),
    "42 added, 3 already there, 1 error",
  );
  assert.equal(
    formatImportSummary({ added: 0, alreadyThere: 0, errors: 2 }),
    "0 added, 0 already there, 2 errors",
  );
});

test("preview flags blank, short codes, duplicates, and codes already in the intake", () => {
  const classified = classifyRosterRows(
    [
      { line: 2, applicationNumber: "1001", name: "Ada" },
      { line: 3, applicationNumber: "1001", name: "Ada Two" },
      { line: 4, applicationNumber: " 1002 ", name: " Bea " },
      { line: 5, applicationNumber: "12", name: "Cy" },
      { line: 6, applicationNumber: "1003", name: " " },
      { line: 7, applicationNumber: "1004", name: "Dee" },
      { line: 8, applicationNumber: "0101", name: "Eve" },
      { line: 9, applicationNumber: "1001.0", name: "Fay" },
      { line: 10, applicationNumber: "1005", name: "Gia", chineseName: "  陳  " },
      { line: 11, applicationNumber: "1006", name: "Hal", chineseName: "   " },
    ],
    new Set(["1004"]),
  );

  const byLine = new Map(classified.map((row) => [row.line, row]));
  assert.deepEqual(byLine.get(2)?.problems, ["duplicate_in_file"]);
  assert.equal(byLine.get(2)?.outcome, "error");
  assert.deepEqual(byLine.get(3)?.problems, ["duplicate_in_file"]);
  assert.equal(byLine.get(4)?.outcome, "add");
  assert.equal(byLine.get(4)?.applicationNumber, "1002");
  assert.equal(byLine.get(4)?.name, "Bea");
  assert.equal(byLine.get(4)?.chineseName, "");
  assert.deepEqual(byLine.get(5)?.problems, ["not_4_digits"]);
  assert.deepEqual(byLine.get(6)?.problems, ["blank"]);
  assert.deepEqual(byLine.get(7)?.problems, ["already_in_intake"]);
  assert.equal(byLine.get(7)?.outcome, "already");
  assert.equal(byLine.get(8)?.applicationNumber, "0101");
  assert.equal(byLine.get(8)?.outcome, "add");
  assert.deepEqual(byLine.get(9)?.problems, ["not_4_digits"]);
  assert.equal(byLine.get(10)?.outcome, "add");
  assert.equal(byLine.get(10)?.chineseName, "陳");
  assert.equal(byLine.get(11)?.outcome, "add");
  assert.equal(byLine.get(11)?.chineseName, "");

  const tally = tallyRoster(classified);
  assert.equal(tally.added, 4);
  assert.equal(tally.alreadyThere, 1);
  assert.equal(tally.errors, 5);
  assert.deepEqual(
    rowsToInsert(classified).map((row) => row.applicationNumber),
    ["1002", "0101", "1005", "1006"],
  );
  assert.equal(rowsToInsert(classified)[2]?.chineseName, "陳");
});

test("a numeric code is not turned into text", () => {
  const normalized = normalizeImportRows([
    { applicationNumber: 1001, name: "Ada" },
    { applicationNumber: "0101", name: "Eve" },
    { applicationNumber: "0102", name: "Fay", chineseName: 1 },
  ]);
  assert.deepEqual(normalized[0], { invalid: true });
  assert.equal("applicationNumber" in normalized[1] && normalized[1].applicationNumber, "0101");
  assert.equal("chineseName" in normalized[1] && normalized[1].chineseName, "");
  assert.deepEqual(normalized[2], { invalid: true });
  const tally = tallyRoster([], normalized.filter((row) => "invalid" in row).length);
  assert.equal(tally.errors, 2);
  assert.equal(rowsToInsert([]).length, 0);
});

test("the roster headers keep both names and ignore ID and 參考編號", () => {
  const mapped = mapRosterSheet(
    ["ID", "參考編號", "提交編號", " English Name ", "Chinese Name"],
    [{ line: 2, cells: ["7", "REF-99", "0101", "Ada Wong", "陳大文"] }],
  );
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.rows[0]?.applicationNumber, "0101");
  assert.equal(mapped.rows[0]?.name, "Ada Wong");
  assert.equal(mapped.rows[0]?.chineseName, "陳大文");
  assert.equal(JSON.stringify(mapped).includes("REF-99"), false);
  assert.equal(JSON.stringify(mapped).includes('"7"'), false);
});

test("Full English name is accepted in any case and English Name wins when both exist", () => {
  const alias = mapRosterSheet(
    ["\uFEFFfull english name", "提交編號"],
    [{ line: 2, cells: ["Ada Wong", "0101"] }],
  );
  assert.equal(alias.ok, true);
  if (!alias.ok) return;
  assert.equal(alias.rows[0]?.name, "Ada Wong");
  assert.equal(alias.rows[0]?.chineseName, "");

  const preferred = mapRosterSheet(
    ["Full English name", "English Name", "提交編號", "chinese name"],
    [{ line: 2, cells: ["Not this", "Ada Wong", "0101", "陳"] }],
  );
  assert.equal(preferred.ok, true);
  if (!preferred.ok) return;
  assert.equal(preferred.rows[0]?.name, "Ada Wong");
  assert.equal(preferred.rows[0]?.chineseName, "陳");
});

test("a missing header is reported", () => {
  const mapped = mapRosterSheet(["Name"], [{ line: 2, cells: ["Ada"] }]);
  assert.equal(mapped.ok, false);
});
