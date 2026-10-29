import assert from "node:assert/strict";
import test from "node:test";

import {
  A4_HEIGHT,
  CARD_HEIGHT,
  QR_CARDS_PER_PAGE,
  cutLinePositions,
  sheetPageCount,
} from "./qrLayout.ts";

test("five cards fill one A4 page and the sixth starts the next", () => {
  assert.equal(QR_CARDS_PER_PAGE, 5);
  assert.equal(sheetPageCount(1), 1);
  assert.equal(sheetPageCount(5), 1);
  assert.equal(sheetPageCount(6), 2);
  assert.ok(Math.abs(CARD_HEIGHT * 5 - A4_HEIGHT) < 0.001);
});

test("cut lines sit between the cards and inside the page", () => {
  const five = cutLinePositions(5);
  assert.equal(five.length, 6);
  assert.ok(five.every((y) => y > 0 && y < A4_HEIGHT));
  const gaps = five.slice(1).map((y, index) => y - five[index]);
  assert.ok(gaps.every((gap) => Math.abs(gap - CARD_HEIGHT) < 0.01 || gap < CARD_HEIGHT));

  const one = cutLinePositions(1);
  assert.equal(one.length, 2);
  assert.ok(one[0] < one[1]);
});
