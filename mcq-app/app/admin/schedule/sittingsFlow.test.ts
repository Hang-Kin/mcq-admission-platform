import assert from "node:assert/strict";
import test from "node:test";

import { isStartInNext24Hours } from "../homeChecklist.ts";
import { hasMathAndChinese, prepareTargetId, sittingsFocus, validateSittingTime } from "./sittingsFlow.ts";

const now = Date.parse("2026-10-28T12:00:00.000Z");
const hours = (count: number) => new Date(now + count * 60 * 60 * 1000).toISOString();

test("a time needs a name and an end after the start", () => {
  assert.equal(validateSittingTime({ label: " ", startsAt: "", endsAt: "" }).ok, false);
  const missingEnd = validateSittingTime({ label: "Morning", startsAt: "", endsAt: "" });
  assert.equal(missingEnd.ok, false);
  if (!missingEnd.ok) assert.equal(missingEnd.error, "Enter a start and an end.");
  const backwards = validateSittingTime({
    label: "Morning",
    startsAt: "2026-10-29T10:00",
    endsAt: "2026-10-29T09:00",
  });
  assert.equal(backwards.ok, false);
  const ok = validateSittingTime({
    label: " Morning ",
    startsAt: "2026-10-29T09:00:00.000Z",
    endsAt: "2026-10-29T10:00:00.000Z",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.label, "Morning");
});

test("13:46 is stored as Hong Kong time and the slot must cover the exam", () => {
  const accepted = validateSittingTime({
    label: "Afternoon",
    startsAt: "2026-11-02T13:46",
    endsAt: "2026-11-02T14:02",
    examMinutes: 16,
  });
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(accepted.startsAt, "2026-11-02T05:46:00.000Z");
    assert.equal(accepted.endsAt, "2026-11-02T06:02:00.000Z");
  }
  const rejected = validateSittingTime({
    label: "Afternoon",
    startsAt: "2026-11-02T13:46",
    endsAt: "2026-11-02T14:01",
    examMinutes: 16,
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.equal(rejected.error, "This slot is 15 minutes but the exam needs 16.");
  }
});

test("prepare targets the next unprepared sitting, not one already prepared", () => {
  const id = prepareTargetId(
    [
      { id: "later", startsAt: hours(20), status: "Not prepared" },
      { id: "soon", startsAt: hours(2), status: "Prepared" },
      { id: "far", startsAt: hours(48), status: "Not prepared" },
      { id: "locked", startsAt: hours(3), status: "Locked" },
    ],
    now,
    isStartInNext24Hours,
  );
  assert.equal(id, "later");

  const farOnly = prepareTargetId(
    [{ id: "far", startsAt: hours(48), status: "Not prepared" }],
    now,
    isStartInNext24Hours,
  );
  assert.equal(farOnly, "far");
  assert.equal(
    prepareTargetId([{ id: "done", startsAt: hours(2), status: "Prepared" }], now, isStartInNext24Hours),
    null,
  );
});

test("the solid button follows the first unfinished step", () => {
  assert.equal(
    sittingsFocus({
      schemaReady: false,
      examCount: 0,
      selectedHasSubjects: false,
      prepareHere: false,
      selectedTimeCount: 0,
      studentCount: 0,
      codedStudentCount: 0,
    }),
    "waiting",
  );
  assert.equal(
    sittingsFocus({
      schemaReady: true,
      examCount: 0,
      selectedHasSubjects: false,
      prepareHere: false,
      selectedTimeCount: 0,
      studentCount: 3,
      codedStudentCount: 0,
    }),
    "create",
  );
  assert.equal(
    sittingsFocus({
      schemaReady: true,
      examCount: 1,
      selectedHasSubjects: false,
      prepareHere: true,
      selectedTimeCount: 1,
      studentCount: 3,
      codedStudentCount: 0,
    }),
    "subjects",
  );
  assert.equal(
    sittingsFocus({
      schemaReady: true,
      examCount: 1,
      selectedHasSubjects: true,
      prepareHere: true,
      selectedTimeCount: 1,
      studentCount: 3,
      codedStudentCount: 0,
    }),
    "prepare",
  );
  assert.equal(
    sittingsFocus({
      schemaReady: true,
      examCount: 1,
      selectedHasSubjects: true,
      prepareHere: false,
      selectedTimeCount: 0,
      studentCount: 3,
      codedStudentCount: 0,
    }),
    "time",
  );
  assert.equal(
    sittingsFocus({
      schemaReady: true,
      examCount: 1,
      selectedHasSubjects: true,
      prepareHere: false,
      selectedTimeCount: 1,
      studentCount: 0,
      codedStudentCount: 0,
    }),
    "students",
  );
  assert.equal(
    sittingsFocus({
      schemaReady: true,
      examCount: 1,
      selectedHasSubjects: true,
      prepareHere: false,
      selectedTimeCount: 1,
      studentCount: 4,
      codedStudentCount: 1,
    }),
    "codes",
  );
  assert.equal(
    sittingsFocus({
      schemaReady: true,
      examCount: 1,
      selectedHasSubjects: true,
      prepareHere: false,
      selectedTimeCount: 1,
      studentCount: 4,
      codedStudentCount: 4,
    }),
    "print",
  );
  assert.equal(hasMathAndChinese(["Math", "Chinese"]), true);
  assert.equal(hasMathAndChinese(["Math", null]), false);
});
