import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PDFDocument } from "pdf-lib";

import {
  buildQrSheetPdf,
  cardTextItems,
  missingGlyphs,
  QR_CODE_LABEL,
  QR_FONT_FILE,
  QrUnprintableNameError,
  type QrCard,
} from "./qrPdf.ts";

const fontBytes = new Uint8Array(
  readFileSync(fileURLToPath(new URL(`../../../assets/fonts/${QR_FONT_FILE}`, import.meta.url))),
);

const secretUrl = "https://qr-sheet-host.invalid/session/qr-secret-token-9f3a";
const longEnglishName =
  "Alexandra Christopher Jonathan Montgomery-Worthington the Third of Hong Kong";

function card(index: number, extra: Partial<QrCard> = {}): QrCard {
  return {
    name: index === 1 ? "José Chan" : `Student ${index}`,
    chineseName: "",
    applicationNumber: String(1000 + index),
    url: secretUrl,
    ...extra,
  };
}

test("a card has the code, the English name, and the Chinese name", () => {
  const items = cardTextItems({
    name: "  Ada Wong  ",
    chineseName: " 陳大文 ",
    applicationNumber: "0101",
    url: secretUrl,
  });
  assert.deepEqual(items, ["提交編號 0101", "Ada Wong", "陳大文"]);
  assert.equal(items.length, 3);
  assert.equal(items.some((item) => item.includes("Entry")), false);
  assert.equal(items.some((item) => item.includes(secretUrl)), false);
});

test("a six-card sheet is two A4 pages and does not print the exam link", async () => {
  const pdf = await buildQrSheetPdf({
    fontBytes,
    cards: [1, 2, 3, 4, 5, 6].map((index) => card(index)),
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

test("five cards stay on one page", async () => {
  const pdf = await buildQrSheetPdf({
    fontBytes,
    cards: [1, 2, 3, 4, 5].map((index) => card(index)),
  });
  const loaded = await PDFDocument.load(pdf);
  assert.equal(loaded.getPageCount(), 1);
});

test("Traditional and HKSCS names and a long English name print", async () => {
  const sample: QrCard = {
    name: longEnglishName,
    chineseName: "彧喆嬡堃",
    applicationNumber: "2408",
    url: secretUrl,
  };
  const items = cardTextItems(sample);
  assert.equal(items[1], longEnglishName);
  assert.equal(items[1]?.includes("..."), false);
  assert.equal(items[2], "彧喆嬡堃");
  const pdf = await PDFDocument.create();
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  pdf.registerFontkit({
    create(buffer: Uint8Array) {
      return fontkit.create(buffer) as never;
    },
  });
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  assert.equal(missingGlyphs(supported, "彧喆嬡堃"), "");
  assert.equal(missingGlyphs(supported, longEnglishName), "");
  const built = await buildQrSheetPdf({ fontBytes, cards: [sample] });
  const loaded = await PDFDocument.load(built);
  assert.equal(loaded.getPageCount(), 1);
});

test("a character the font lacks stops the sheet and names the student", async () => {
  const good = card(1, { name: "Ada Wong", chineseName: "陳大文", applicationNumber: "1001" });
  const bad = card(2, {
    name: "Bea 😀 Chan",
    chineseName: "嬡",
    applicationNumber: "2408",
  });
  await assert.rejects(
    () => buildQrSheetPdf({ fontBytes, cards: [good, bad] }),
    (error: unknown) => {
      assert.ok(error instanceof QrUnprintableNameError);
      assert.match(error.message, /2408/);
      assert.match(error.message, /Bea/);
      assert.match(error.message, /😀/);
      assert.equal(error.message.includes("1001"), false);
      assert.equal(error.students.length, 1);
      assert.equal(error.students[0]?.applicationNumber, "2408");
      return true;
    },
  );
});
