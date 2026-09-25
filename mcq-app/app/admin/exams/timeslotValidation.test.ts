import assert from "node:assert/strict";
import test from "node:test";

import {
  automaticTimeslotId,
  overlappingTimeslotLabels,
  validateTimeslotFields,
  windowsOverlap,
} from "./timeslotValidation.ts";

test("rejects end at or before start", () => {
  const result = validateTimeslotFields({
    label: "A",
    questionSet: "General",
    startsAt: "2026-09-25T10:00:00.000Z",
    endsAt: "2026-09-25T10:00:00.000Z",
  });
  assert.equal(result.ok, false);
});

test("accepts end after start", () => {
  const result = validateTimeslotFields({
    label: "A",
    questionSet: "General",
    startsAt: "2026-09-25T09:00:00.000Z",
    endsAt: "2026-09-25T10:00:00.000Z",
  });
  assert.equal(result.ok, true);
});

test("detects half-open overlap", () => {
  assert.equal(
    windowsOverlap(
      "2026-09-25T09:00:00.000Z",
      "2026-09-25T10:00:00.000Z",
      "2026-09-25T09:30:00.000Z",
      "2026-09-25T11:00:00.000Z",
    ),
    true,
  );
  assert.equal(
    windowsOverlap(
      "2026-09-25T09:00:00.000Z",
      "2026-09-25T10:00:00.000Z",
      "2026-09-25T10:00:00.000Z",
      "2026-09-25T11:00:00.000Z",
    ),
    false,
  );
});

test("late gap uses next unfinished slot", () => {
  const slots = [
    {
      id: "a",
      label: "A",
      starts_at: "2026-09-25T09:00:00.000Z",
      ends_at: "2026-09-25T10:00:00.000Z",
    },
    {
      id: "b",
      label: "B",
      starts_at: "2026-09-25T10:30:00.000Z",
      ends_at: "2026-09-25T11:30:00.000Z",
    },
  ];
  assert.equal(
    automaticTimeslotId(slots, Date.parse("2026-09-25T10:15:00.000Z")),
    "b",
  );
  assert.equal(
    overlappingTimeslotLabels(
      {
        startsAt: "2026-09-25T09:45:00.000Z",
        endsAt: "2026-09-25T10:45:00.000Z",
      },
      slots,
    ).join(","),
    "A,B",
  );
});
