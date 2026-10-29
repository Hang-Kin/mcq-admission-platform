export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
export const QR_CARDS_PER_PAGE = 5;
export const CARD_HEIGHT = A4_HEIGHT / QR_CARDS_PER_PAGE;
const CUT_INSET = 14;

export function sheetPageCount(cardCount: number): number {
  if (cardCount <= 0) return 0;
  return Math.ceil(cardCount / QR_CARDS_PER_PAGE);
}

export function cardsOnPage(cardCount: number, pageIndex: number): number {
  const start = pageIndex * QR_CARDS_PER_PAGE;
  return Math.max(0, Math.min(QR_CARDS_PER_PAGE, cardCount - start));
}

export function bandBottom(slot: number): number {
  return A4_HEIGHT - (slot + 1) * CARD_HEIGHT;
}

export function cutLinePositions(cardsOnPageCount: number): number[] {
  if (cardsOnPageCount <= 0) return [];
  const top = A4_HEIGHT - CUT_INSET;
  const bottom = A4_HEIGHT - cardsOnPageCount * CARD_HEIGHT + CUT_INSET;
  const lines = [top, bottom];
  for (let slot = 1; slot < cardsOnPageCount; slot += 1) {
    lines.push(A4_HEIGHT - slot * CARD_HEIGHT);
  }
  return lines.sort((a, b) => a - b);
}
