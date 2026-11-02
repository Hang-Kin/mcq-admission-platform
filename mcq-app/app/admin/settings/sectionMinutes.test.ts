import assert from "node:assert/strict";
import test from "node:test";

import {
  earliestSectionPlan,
  examMinuteTotals,
  MINUTES_LOCKED_MESSAGE,
  resolveSavedDuration,
  sectionDurationView,
  sectionMinuteUpdates,
  shortSlotWarning,
  slotLengthError,
  subjectMinutesFromRows,
  totalExamMinutes,
} from "./sectionMinutes.ts";

const settings = subjectMinutesFromRows([
  { subject: "Math", durationMinutes: 8 },
  { subject: "Chinese", durationMinutes: 8 },
]);

const sections = [
  { subject: "Math", position: 0, durationMinutes: 7 },
  { subject: "Chinese", position: 1, durationMinutes: 8 },
];

test("subject settings replace the stored 7 until a student starts", () => {
  assert.deepEqual(settings, { Math: 8, Chinese: 8 });
  assert.equal(
    totalExamMinutes({ sections, settings, started: false, plan: null }),
    16,
  );
  const math = sectionDurationView({
    subject: "Math",
    position: 0,
    storedMinutes: 7,
    settings,
    started: false,
    plan: null,
  });
  assert.deepEqual(math, { minutes: 8, locked: true, note: "From Subject settings." });
  const saved = resolveSavedDuration({
    started: false,
    subject: "Math",
    storedMinutes: 7,
    submittedMinutes: 9,
    settings,
  });
  assert.deepEqual(saved, { ok: true, minutes: 8 });
});

test("a started exam keeps the first snapshot and rejects a new number", () => {
  const plan = [
    { position: 0, duration_minutes: 8 },
    { position: 1, duration_minutes: 8 },
  ];
  assert.equal(totalExamMinutes({ sections, settings: { Math: 10, Chinese: 10 }, started: true, plan }), 16);
  const view = sectionDurationView({
    subject: "Math",
    position: 0,
    storedMinutes: 7,
    settings: { Math: 10, Chinese: 10 },
    started: true,
    plan,
  });
  assert.equal(view.minutes, 8);
  assert.equal(view.locked, true);
  const blocked = resolveSavedDuration({
    started: true,
    subject: "Math",
    storedMinutes: 7,
    submittedMinutes: 10,
    settings: { Math: 10, Chinese: 10 },
  });
  assert.deepEqual(blocked, { ok: false, error: MINUTES_LOCKED_MESSAGE });
  const same = resolveSavedDuration({
    started: true,
    subject: "Math",
    storedMinutes: 7,
    submittedMinutes: 7,
    settings: { Math: 10, Chinese: 10 },
  });
  assert.deepEqual(same, { ok: true, minutes: 7 });
  const shownSnapshot = resolveSavedDuration({
    started: true,
    subject: "Math",
    storedMinutes: 7,
    submittedMinutes: 8,
    effectiveMinutes: 8,
    settings: { Math: 10, Chinese: 10 },
  });
  assert.deepEqual(shownSnapshot, { ok: true, minutes: 7 });
});

test("saving subject settings updates only exams that nobody has started", () => {
  const updates = sectionMinuteUpdates({
    sections: [
      { id: "open-math", examId: "open", subject: "Math", durationMinutes: 7 },
      { id: "open-chinese", examId: "open", subject: "Chinese", durationMinutes: 8 },
      { id: "started-math", examId: "started", subject: "Math", durationMinutes: 7 },
      { id: "custom", examId: "open", subject: null, durationMinutes: 5 },
    ],
    startedExamIds: ["started"],
    settings,
  });
  assert.deepEqual(updates, [{ id: "open-math", examId: "open", durationMinutes: 8 }]);
});

test("the earliest started plan is the one that stays fixed", () => {
  const plan = earliestSectionPlan([
    { startedAt: "2026-11-02T02:00:00.000Z", plan: [{ position: 0, duration_minutes: 9 }] },
    { startedAt: "2026-11-02T01:00:00.000Z", plan: [{ position: 0, duration_minutes: 8 }] },
  ]);
  assert.deepEqual(plan, [{ position: 0, duration_minutes: 8 }]);
  const totals = examMinuteTotals({
    sections: [
      { examId: "open", subject: "Math", position: 0, durationMinutes: 7 },
      { examId: "open", subject: "Chinese", position: 1, durationMinutes: 8 },
      { examId: "started", subject: "Math", position: 0, durationMinutes: 7 },
    ],
    startedExamIds: ["started"],
    plans: [{ examId: "started", startedAt: "2026-11-02T01:00:00.000Z", plan }],
    settings,
  });
  assert.equal(totals.get("open"), 16);
  assert.equal(totals.get("started"), 8);
});

test("a 15 minute slot is rejected and a 16 minute slot is accepted", () => {
  const start = Date.parse("2026-11-02T05:46:00.000Z");
  assert.equal(
    slotLengthError(start, start + 15 * 60_000, 16),
    "This slot is 15 minutes but the exam needs 16.",
  );
  assert.equal(slotLengthError(start, start + 16 * 60_000, 16), null);
  assert.equal(
    shortSlotWarning("2026-11-02T13:46", "2026-11-02T14:01", 16),
    "This slot is 15 minutes but the exam needs 16.",
  );
  assert.equal(shortSlotWarning("2026-11-02T13:46", "2026-11-02T14:02", 16), null);
  assert.equal(
    shortSlotWarning("2026-11-02T13:46:00.000Z", "2026-11-02T13:52:00.000Z", 16),
    "This slot is 6 minutes but the exam needs 16.",
  );
});
