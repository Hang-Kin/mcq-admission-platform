import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  setFillingColor,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
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

const INK = rgb(0, 0, 0);
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

export type QrTextFont = "times" | "noto";

export type QrTextPiece = {
  text: string;
  font: QrTextFont;
  x: number;
};

export type QrTextLine = {
  size: number;
  pieces: QrTextPiece[];
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
  const code = pdfPlainText(card.applicationNumber);
  const english = pdfPlainText(card.name);
  const chinese = pdfPlainText(card.chineseName);
  return [`${QR_CODE_LABEL} ${code}`.trim(), english, chinese];
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

export function numberOffset(labelWidth: number, spaceWidth: number): number {
  return labelWidth + spaceWidth;
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

function cardTextWidth(): number {
  const qrX = A4_WIDTH - CARD_MARGIN - QR_SIZE;
  return qrX - CARD_MARGIN - TEXT_GAP;
}

export function layoutQrCard(
  times: PDFFont,
  noto: PDFFont,
  card: QrCard,
  textWidth: number,
): QrTextLine[] | null {
  const code = pdfPlainText(card.applicationNumber);
  const english = pdfPlainText(card.name);
  const chinese = pdfPlainText(card.chineseName);

  for (const size of TEXT_SIZES) {
    const timesWidth = (value: string) => times.widthOfTextAtSize(value, size);
    const notoWidth = (value: string) => noto.widthOfTextAtSize(value, size);
    const labelWidth = notoWidth(QR_CODE_LABEL);
    const spaceWidth = timesWidth(" ");
    const offset = numberOffset(labelWidth, spaceWidth);
    if (offset + timesWidth(code) > textWidth) continue;

    const englishLines = wrapText(english, timesWidth, textWidth);
    const chineseLines = wrapText(chinese, notoWidth, textWidth);
    const lines: QrTextLine[] = [
      {
        size,
        pieces: [
          { text: QR_CODE_LABEL, font: "noto", x: 0 },
          ...(code ? [{ text: code, font: "times" as const, x: offset }] : []),
        ],
      },
      ...englishLines.map((text) => ({
        size,
        pieces: [{ text, font: "times" as const, x: 0 }],
      })),
      ...chineseLines.map((text) => ({
        size,
        pieces: [{ text, font: "noto" as const, x: 0 }],
      })),
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

function drawInkText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  x: number,
  y: number,
  size: number,
) {
  page.pushOperators(setFillingColor(INK));
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function studentIdentity(card: QrCard): Omit<UnprintableStudent, "missing"> {
  return {
    applicationNumber: pdfPlainText(card.applicationNumber),
    name: pdfPlainText(card.name),
    chineseName: pdfPlainText(card.chineseName),
  };
}

function missingFromEncodeError(error: unknown): string | null {
  if (!(error instanceof Error) || !error.message.includes("cannot encode")) return null;
  const match = /cannot encode "([^"]*)"/.exec(error.message);
  return match?.[1] || error.message;
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
  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  // Subsetting this CFF font writes outlines that viewers cannot paint, so the
  // label and Chinese name come out blank. Embed the full Noto file.
  const noto = await pdf.embedFont(input.fontBytes, { subset: false });
  const timesSet = new Set(times.getCharacterSet());
  const notoSet = new Set(noto.getCharacterSet());
  for (const char of QR_CODE_LABEL) {
    const code = char.codePointAt(0);
    if (code == null || !notoSet.has(code)) {
      throw new Error("The QR font cannot print 提交編號.");
    }
  }

  const unprintable: UnprintableStudent[] = [];
  for (const card of input.cards) {
    const code = pdfPlainText(card.applicationNumber);
    const english = pdfPlainText(card.name);
    const chinese = pdfPlainText(card.chineseName);
    const missing =
      missingGlyphs(timesSet, `${code}${english}`) + missingGlyphs(notoSet, chinese);
    if (missing.length > 0) {
      unprintable.push({ ...studentIdentity(card), missing });
    }
  }
  if (unprintable.length > 0) throw new QrUnprintableNameError(unprintable);

  const textWidth = cardTextWidth();
  const layouts: QrTextLine[][] = [];
  const overflow: Array<{ applicationNumber: string; name: string }> = [];
  for (const card of input.cards) {
    try {
      const lines = layoutQrCard(times, noto, card, textWidth);
      if (!lines) {
        overflow.push({
          applicationNumber: pdfPlainText(card.applicationNumber),
          name: pdfPlainText(card.name),
        });
        layouts.push([]);
      } else {
        layouts.push(lines);
      }
    } catch (error) {
      const missing = missingFromEncodeError(error);
      if (!missing) throw error;
      unprintable.push({ ...studentIdentity(card), missing });
      layouts.push([]);
    }
  }
  if (unprintable.length > 0) throw new QrUnprintableNameError(unprintable);
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
      try {
        await drawCard(pdf, page, times, noto, slot, card, lines);
      } catch (error) {
        const missing = missingFromEncodeError(error);
        if (!missing) throw error;
        throw new QrUnprintableNameError([{ ...studentIdentity(card), missing }]);
      }
    }
  }

  if (pageCount === 0) pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  return pdf.save();
}

async function drawCard(
  pdf: PDFDocument,
  page: PDFPage,
  times: PDFFont,
  noto: PDFFont,
  slot: number,
  card: QrCard,
  lines: QrTextLine[],
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
    for (const piece of line.pieces) {
      if (!piece.text) continue;
      drawInkText(
        page,
        piece.text,
        piece.font === "times" ? times : noto,
        CARD_MARGIN + piece.x,
        baseline,
        line.size,
      );
    }
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
