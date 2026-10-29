import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { toBuffer } from "qrcode";

import {
  A4_HEIGHT,
  A4_WIDTH,
  CARD_HEIGHT,
  QR_CARDS_PER_PAGE,
  bandBottom,
  cardsOnPage,
  cutLinePositions,
  sheetPageCount,
} from "./qrLayout";

export const QR_CODE_LABEL = "提交編號";

export type QrCard = {
  name: string;
  applicationNumber: string;
  intakeLabel: string;
  url: string;
};

export function pdfPlainText(value: string): string {
  return value
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function keepDrawableText(supported: ReadonlySet<number>, text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code != null && supported.has(code)) out += char;
  }
  return out;
}

function wrapText(text: string, widthOf: (value: string) => number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";

  function pushLongWord(word: string) {
    let piece = "";
    for (const char of word) {
      const next = piece + char;
      if (widthOf(next) <= maxWidth) {
        piece = next;
      } else {
        if (piece) lines.push(piece);
        piece = char;
      }
    }
    current = piece;
  }

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && widthOf(next) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      if (widthOf(word) <= maxWidth) current = word;
      else pushLongWord(word);
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 2) return lines;
  const kept = lines.slice(0, 2);
  const last = kept[1] ?? "";
  const trimmed = last.length > 3 ? `${last.slice(0, last.length - 3)}...` : last;
  kept[1] = widthOf(trimmed) <= maxWidth ? trimmed : last;
  return kept;
}

function drawCutLines(page: PDFPage, count: number) {
  for (const y of cutLinePositions(count)) {
    page.drawLine({
      start: { x: 16, y },
      end: { x: A4_WIDTH - 16, y },
      thickness: 0.7,
      color: rgb(0, 0, 0),
      dashArray: [4, 3],
    });
  }
}

export async function buildQrSheetPdf(input: {
  fontBytes: Uint8Array;
  cards: QrCard[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit({
    create(buffer: Uint8Array) {
      return fontkit.create(buffer) as never;
    },
  });
  pdf.setTitle("QR codes");
  const font = await pdf.embedFont(input.fontBytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  for (const char of QR_CODE_LABEL) {
    const code = char.codePointAt(0);
    if (code == null || !supported.has(code)) {
      throw new Error("The QR font cannot print 提交編號.");
    }
  }

  const pageCount = sheetPageCount(input.cards.length);
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    const count = cardsOnPage(input.cards.length, pageIndex);
    drawCutLines(page, count);
    for (let slot = 0; slot < count; slot += 1) {
      const card = input.cards[pageIndex * QR_CARDS_PER_PAGE + slot];
      if (!card) continue;
      await drawCard(pdf, page, font, supported, slot, card);
    }
  }

  if (pageCount === 0) pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  return pdf.save();
}

async function drawCard(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  supported: ReadonlySet<number>,
  slot: number,
  card: QrCard,
) {
  const qrSize = 104;
  const margin = 28;
  const bottom = bandBottom(slot);
  const qrX = A4_WIDTH - margin - qrSize;
  const qrY = bottom + (CARD_HEIGHT - qrSize) / 2;
  const textWidth = qrX - margin - 16;
  const widthOf = (value: string) => font.widthOfTextAtSize(value, 15);

  const name = keepDrawableText(supported, pdfPlainText(card.name));
  const code = keepDrawableText(supported, pdfPlainText(card.applicationNumber));
  const intake = keepDrawableText(supported, pdfPlainText(card.intakeLabel));
  const nameLines = name ? wrapText(name, widthOf, textWidth) : [];
  const lines = [
    ...nameLines.map((text) => ({ text, size: 15 })),
    { text: `${QR_CODE_LABEL} ${code}`.trim(), size: 13 },
    ...(intake ? [{ text: intake, size: 12 }] : []),
  ];
  const gap = 6;
  const blockHeight = lines.reduce(
    (sum, line, index) => sum + line.size + (index === 0 ? 0 : gap),
    0,
  );
  let baseline = bottom + (CARD_HEIGHT + blockHeight) / 2 - lines[0].size;
  for (const line of lines) {
    page.drawText(line.text, {
      x: margin,
      y: baseline,
      size: line.size,
      font,
      color: rgb(0, 0, 0),
    });
    baseline -= line.size + gap;
  }

  const png = await toBuffer(card.url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
  });
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: qrX, y: qrY, width: qrSize, height: qrSize });
}
