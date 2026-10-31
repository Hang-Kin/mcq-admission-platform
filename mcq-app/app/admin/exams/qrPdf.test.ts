import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  buildQrSheetPdf,
  cardTextItems,
  layoutQrCard,
  missingGlyphs,
  numberOffset,
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
  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  const noto = await pdf.embedFont(fontBytes, { subset: false });
  assert.equal(missingGlyphs(new Set(noto.getCharacterSet()), "彧喆嬡堃"), "");
  assert.equal(missingGlyphs(new Set(times.getCharacterSet()), longEnglishName), "");
  const built = await buildQrSheetPdf({ fontBytes, cards: [sample] });
  const loaded = await PDFDocument.load(built);
  assert.equal(loaded.getPageCount(), 1);
});

function pageContent(pdf: Uint8Array): string {
  const buf = Buffer.from(pdf);
  const src = buf.toString("latin1");
  const parts: string[] = [];
  const marker = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(src))) {
    const start = match.index + match[0].length;
    const end = src.indexOf("endstream", start);
    if (end < 0) break;
    let rawEnd = end;
    if (src[rawEnd - 1] === "\n") rawEnd -= 1;
    if (src[rawEnd - 1] === "\r") rawEnd -= 1;
    const raw = buf.subarray(start, rawEnd);
    let text = "";
    try {
      text = inflateSync(raw).toString("latin1");
    } catch {
      text = raw.toString("latin1");
    }
    if (text.includes("Tj") || text.includes(" rg")) parts.push(text);
  }
  return parts.join("\n");
}

test("the label and number are separate fonts and the number follows the label width", async () => {
  const pdf = await PDFDocument.create();
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  pdf.registerFontkit({
    create(buffer: Uint8Array) {
      return fontkit.create(buffer) as never;
    },
  });
  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  const noto = await pdf.embedFont(fontBytes, { subset: false });
  const sample: QrCard = {
    name: "Ada Wong",
    chineseName: "陳大文",
    applicationNumber: "0101",
    url: secretUrl,
  };
  const size = 15;
  const lines = layoutQrCard(times, noto, sample, 400);
  assert.ok(lines);
  if (!lines) return;
  assert.equal(lines.length, 3);
  assert.equal(lines[0]?.pieces[0]?.text, "提交編號");
  assert.equal(lines[0]?.pieces[0]?.font, "noto");
  assert.equal(lines[0]?.pieces[0]?.x, 0);
  assert.equal(lines[0]?.pieces[1]?.text, "0101");
  assert.equal(lines[0]?.pieces[1]?.font, "times");
  const labelWidth = noto.widthOfTextAtSize(QR_CODE_LABEL, size);
  const spaceWidth = times.widthOfTextAtSize(" ", size);
  assert.equal(lines[0]?.pieces[1]?.x, numberOffset(labelWidth, spaceWidth));
  assert.equal(lines[1]?.pieces[0]?.text, "Ada Wong");
  assert.equal(lines[1]?.pieces[0]?.font, "times");
  assert.equal(lines[2]?.pieces[0]?.text, "陳大文");
  assert.equal(lines[2]?.pieces[0]?.font, "noto");
  assert.equal(JSON.stringify(lines).includes("Entry"), false);
});

test("English text is Times, Chinese text is separate, and every run is black", async () => {
  const pdf = await buildQrSheetPdf({
    fontBytes,
    cards: [
      {
        name: "Ada Wong",
        chineseName: "陳大文",
        applicationNumber: "0101",
        url: secretUrl,
      },
    ],
  });
  const content = pageContent(pdf);
  assert.equal(content.includes("Times-Roman"), true);
  const blackRuns = content.match(/0 0 0 rg/g) ?? [];
  assert.ok(blackRuns.length >= 4);
  assert.equal(content.includes("<41646120576F6E67>"), true);
  assert.equal(content.includes("<30313031>"), true);
  assert.ok((content.match(/Tj/g) ?? []).length >= 4);
  assert.equal(content.includes("qr-sheet-host.invalid"), false);
  assert.equal(content.includes("/session/"), false);
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
      assert.equal(error.message.includes("WinAnsi cannot encode"), false);
      return true;
    },
  );
});

test("an English name Times cannot encode names the student", async () => {
  await assert.rejects(
    () =>
      buildQrSheetPdf({
        fontBytes,
        cards: [card(1, { name: "Chan 李", chineseName: "嬡", applicationNumber: "2408" })],
      }),
    (error: unknown) => {
      assert.ok(error instanceof QrUnprintableNameError);
      assert.equal(error.name, "QrUnprintableNameError");
      assert.match(error.message, /2408/);
      assert.match(error.message, /Chan/);
      assert.match(error.message, /李/);
      assert.equal(error.message.includes("1001"), false);
      assert.equal(error.message.includes("WinAnsi cannot encode"), false);
      return true;
    },
  );
});

test("a character dropped from the reduced Noto file names the student", async () => {
  await assert.rejects(
    () =>
      buildQrSheetPdf({
        fontBytes,
        cards: [card(1, { name: "Ada Wong", chineseName: "陳Ä", applicationNumber: "1009" })],
      }),
    (error: unknown) => {
      assert.ok(error instanceof QrUnprintableNameError);
      assert.match(error.message, /1009/);
      assert.match(error.message, /Ada Wong/);
      assert.match(error.message, /Ä/);
      assert.equal(error.message.includes("WinAnsi cannot encode"), false);
      return true;
    },
  );
});

test("a Chinese character the font lacks names the student", async () => {
  await assert.rejects(
    () =>
      buildQrSheetPdf({
        fontBytes,
        cards: [card(1, { name: "Ada Wong", chineseName: "陳😀", applicationNumber: "1008" })],
      }),
    (error: unknown) => {
      assert.ok(error instanceof QrUnprintableNameError);
      assert.match(error.message, /1008/);
      assert.match(error.message, /Ada Wong/);
      assert.match(error.message, /😀/);
      assert.equal(error.message.includes("WinAnsi cannot encode"), false);
      return true;
    },
  );
});
