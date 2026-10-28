import assert from "node:assert/strict";
import test from "node:test";

import {
  FRACTION_BLANK_MESSAGE,
  FRACTION_DENOMINATOR_MESSAGE,
  FRACTION_INTEGER_MESSAGE,
  fractionAnswer,
} from "./[token]/fractionAnswer.ts";

test("submits the trimmed a/b string without reducing", () => {
  assert.deepEqual(fractionAnswer("2", "6"), { ok: true, answer: "2/6" });
  assert.deepEqual(fractionAnswer(" 4 ", " 6 "), { ok: true, answer: "4/6" });
  assert.deepEqual(fractionAnswer("10", "15"), { ok: true, answer: "10/15" });
  assert.deepEqual(fractionAnswer("-2", "3"), { ok: true, answer: "-2/3" });
});

test("rejects a blank, a non-integer, or a denominator that is not positive", () => {
  assert.deepEqual(fractionAnswer("", ""), { ok: false, message: null });
  assert.deepEqual(fractionAnswer("2", ""), {
    ok: false,
    message: FRACTION_BLANK_MESSAGE,
  });
  assert.deepEqual(fractionAnswer("", "6"), {
    ok: false,
    message: FRACTION_BLANK_MESSAGE,
  });
  assert.deepEqual(fractionAnswer("2.5", "6"), {
    ok: false,
    message: FRACTION_INTEGER_MESSAGE,
  });
  assert.deepEqual(fractionAnswer("02", "6"), {
    ok: false,
    message: FRACTION_INTEGER_MESSAGE,
  });
  assert.deepEqual(fractionAnswer("2", "0"), {
    ok: false,
    message: FRACTION_DENOMINATOR_MESSAGE,
  });
  assert.deepEqual(fractionAnswer("2", "-3"), {
    ok: false,
    message: FRACTION_DENOMINATOR_MESSAGE,
  });
});
