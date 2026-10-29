import assert from "node:assert/strict";
import test from "node:test";

import { strToU8, zipSync } from "fflate";

import { readRosterFile } from "./readSheet.ts";

function textFile(path: string, xml: string): [string, Uint8Array] {
  return [path, strToU8(xml)];
}

function workbook(): Uint8Array {
  const shared = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>提交編號</t></si>
  <si><t>Full English name</t></si>
  <si><t>Other</t></si>
  <si><t>Ada Wong</t></si>
  <si><t>Bea</t></si>
</sst>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
    </row>
    <row r="2">
      <c r="A2"><v>0101</v></c>
      <c r="B2" t="s"><v>3</v></c>
      <c r="C2"><v>99</v></c>
    </row>
    <row r="3">
      <c r="A3" t="inlineStr"><is><t>1002</t></is></c>
      <c r="B3" t="s"><v>4</v></c>
    </row>
  </sheetData>
</worksheet>`;
  const book = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Roster" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;
  return zipSync(
    Object.fromEntries([
      textFile("xl/sharedStrings.xml", shared),
      textFile("xl/worksheets/sheet1.xml", sheet),
      textFile("xl/workbook.xml", book),
      textFile("xl/_rels/workbook.xml.rels", rels),
    ]),
  );
}

test("xlsx cells stay text, including a leading zero stored in the file", () => {
  const result = readRosterFile("roster.xlsx", workbook());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(typeof result.rows[0]?.applicationNumber, "string");
  assert.equal(result.rows[0]?.applicationNumber, "0101");
  assert.equal(result.rows[0]?.name, "Ada Wong");
  assert.equal(result.rows[1]?.applicationNumber, "1002");
  assert.equal(result.rows[1]?.name, "Bea");
  assert.equal(JSON.stringify(result).includes('"99"'), false);
});

test("csv codes stay text and ignore extra columns", () => {
  const csv = "\uFEFFOther,提交編號,Full English name\nskip,0101,Ada Wong\n";
  const result = readRosterFile("roster.csv", strToU8(csv));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(typeof result.rows[0]?.applicationNumber, "string");
  assert.equal(result.rows[0]?.applicationNumber, "0101");
  assert.equal(result.rows[0]?.name, "Ada Wong");
});
