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
export const QR_FONT_FILE = "NotoSansHK-Regular.otf";

const CARD_MARGIN = 28;
const QR_SIZE = 104;
const TEXT_GAP = 16;
const LINE_GAP = 4;
const TEXT_SIZES = [15, 13, 11, 9];

export type QrCard = {
  name: string;
  chineseName: string;
  applicationNumber: string;
  url: string;
};

export type UnprintableStudent = {
  applicationNumber: string;
  name: string;
  chineseName: string;
  missing: string;
};

export class QrUnprintableNameError extends Error {
  readonly students: UnprintableStudent[];

  constructor(students: UnprintableStudent[]) {
    const listed = students
      .map((student) => {
        const who = [student.applicationNumber, student.name, student.chineseName]
          .filter((part) => part.length > 0)
          .join(" ");
        return `${who} (missing ${student.missing})`;
      })
      .join("; ");
    super(`The font cannot print these names: ${listed}`);
    this.name = "QrUnprintableNameError";
    this.students = students;
  }
}

export class QrNameDoesNotFitError extends Error {
  readonly students: Array<{ applicationNumber: string; name: string }>;

  constructor(students: Array<{ applicationNumber: string; name: string }>) {
    const listed = students
      .map((student) =>
        [student.applicationNumber, student.name].filter((part) => part.length > 0).join(" "),
      )
      .join("; ");
    super(`These names are too long to fit on the card: ${listed}`);
    this.name = "QrNameDoesNotFitError";
    this.students = students;
  }
}

export function pdfPlainText(value: string): string {
  return value
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cardTextItems(card: QrCard): [string, string, string] {
  return [
    `${QR_CODE_LABEL} ${pdfPlainText(card.applicationNumber)}`.trim(),
    pdfPlainText(card.name),
    pdfPlainText(card.chineseName),
  ];
}

export function missingGlyphs(supported: ReadonlySet<number>, text: string): string {
  let missing = "";
  const seen = new Set<number>();
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code == null || seen.has(code)) continue;
    seen.add(code);
    if (!supported.has(code)) missing += char;
  }
  return missing;
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
  return lines;
}

type DrawnLine = { text: string; size: number };

function cardTextWidth(): number {
  const qrX = A4_WIDTH - CARD_MARGIN - QR_SIZE;
  return qrX - CARD_MARGIN - TEXT_GAP;
}

function layoutCardLines(font: PDFFont, card: QrCard, textWidth: number): DrawnLine[] | null {
  const [code, english, chinese] = cardTextItems(card);
  for (const size of TEXT_SIZES) {
    const widthOf = (value: string) => font.widthOfTextAtSize(value, size);
    const lines: DrawnLine[] = [
      { text: code, size },
      ...wrapText(english, widthOf, textWidth).map((text) => ({ text, size })),
      ...wrapText(chinese, widthOf, textWidth).map((text) => ({ text, size })),
    ];
    const blockHeight = lines.reduce(
      (sum, line, index) => sum + line.size + (index === 0 ? 0 : LINE_GAP),
      0,
    );
    if (blockHeight <= CARD_HEIGHT - 28) return lines;
  }
  return null;
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

  const unprintable: UnprintableStudent[] = [];
  for (const card of input.cards) {
    const [, english, chinese] = cardTextItems(card);
    const missing = missingGlyphs(
      supported,
      `${pdfPlainText(card.applicationNumber)}${english}${chinese}`,
    );
    if (missing.length > 0) {
      unprintable.push({
        applicationNumber: pdfPlainText(card.applicationNumber),
        name: english,
        chineseName: chinese,
        missing,
      });
    }
  }
  if (unprintable.length > 0) throw new QrUnprintableNameError(unprintable);

  const textWidth = cardTextWidth();
  const layouts: DrawnLine[][] = [];
  const overflow: Array<{ applicationNumber: string; name: string }> = [];
  for (const card of input.cards) {
    const lines = layoutCardLines(font, card, textWidth);
    if (!lines) {
      overflow.push({
        applicationNumber: pdfPlainText(card.applicationNumber),
        name: pdfPlainText(card.name),
      });
      layouts.push([]);
    } else {
      layouts.push(lines);
    }
  }
  if (overflow.length > 0) throw new QrNameDoesNotFitError(overflow);

  const pageCount = sheetPageCount(input.cards.length);
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    const count = cardsOnPage(input.cards.length, pageIndex);
    drawCutLines(page, count);
    for (let slot = 0; slot < count; slot += 1) {
      const cardIndex = pageIndex * QR_CARDS_PER_PAGE + slot;
      const card = input.cards[cardIndex];
      const lines = layouts[cardIndex];
      if (!card || !lines) continue;
      await drawCard(pdf, page, font, slot, card, lines);
    }
  }

  if (pageCount === 0) pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  return pdf.save();
}

async function drawCard(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  slot: number,
  card: QrCard,
  lines: DrawnLine[],
) {
  const bottom = bandBottom(slot);
  const qrX = A4_WIDTH - CARD_MARGIN - QR_SIZE;
  const qrY = bottom + (CARD_HEIGHT - QR_SIZE) / 2;
  const blockHeight = lines.reduce(
    (sum, line, index) => sum + line.size + (index === 0 ? 0 : LINE_GAP),
    0,
  );
  let baseline = bottom + (CARD_HEIGHT + blockHeight) / 2 - (lines[0]?.size ?? 0);
  for (const line of lines) {
    page.drawText(line.text, {
      x: CARD_MARGIN,
      y: baseline,
      size: line.size,
      font,
      color: rgb(0, 0, 0),
    });
    baseline -= line.size + LINE_GAP;
  }

  const png = await toBuffer(card.url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
  });
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: qrX, y: qrY, width: QR_SIZE, height: QR_SIZE });
}
