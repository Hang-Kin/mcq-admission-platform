import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PDFDocument } from "pdf-lib";

import { buildQrSheetPdf, keepDrawableText, QR_CODE_LABEL } from "./qrPdf.ts";

const fontBytes = new Uint8Array(
  readFileSync(fileURLToPath(new URL("../../../assets/fonts/NotoSansSC-subset.ttf", import.meta.url))),
);

const secretUrl = "https://qr-sheet-host.invalid/session/qr-secret-token-9f3a";

function card(index: number) {
  return {
    name: index === 1 ? "José Chan" : `Student ${index}`,
    applicationNumber: String(1000 + index),
    intakeLabel: "2026 October Entry",
    url: secretUrl,
  };
}

test("the sheet keeps drawable text and drops a missing glyph", () => {
  const supported = new Set("José 提交編號".split("").map((char) => char.codePointAt(0) ?? 0));
  assert.equal(keepDrawableText(supported, "José"), "José");
  assert.equal(keepDrawableText(supported, "李"), "");
});

test("a six-card sheet is two A4 pages and does not print the exam link", async () => {
  const pdf = await buildQrSheetPdf({
    fontBytes,
    cards: [1, 2, 3, 4, 5, 6].map(card),
  });
  assert.equal(Buffer.from(pdf.subarray(0, 5)).toString(), "%PDF-");
  const bytes = Buffer.from(pdf);
  assert.equal(bytes.includes(Buffer.from("qr-sheet-host.invalid")), false);
  assert.equal(bytes.includes(Buffer.from("qr-secret-token-9f3a")), false);
  assert.equal(bytes.includes(Buffer.from("/session/")), false);
  const loaded = await PDFDocument.load(pdf);
  assert.equal(loaded.getPageCount(), 2);
  assert.equal(loaded.getTitle(), "QR codes");
  assert.ok(bytes.length > 8000);
  assert.equal(QR_CODE_LABEL, "提交編號");
});
