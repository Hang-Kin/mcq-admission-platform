import assert from "node:assert/strict";
import test from "node:test";

import {
  isStartInNext24Hours,
  markPrimary,
  nextExamId,
  qrChecklist,
  questionsChecklist,
  resultsChecklist,
  sittingsChecklist,
} from "./homeChecklist.ts";

const now = Date.parse("2026-10-28T12:00:00.000Z");
const hours = (count: number) => new Date(now + count * 60 * 60 * 1000).toISOString();

test("questions are ready only when every topic in both subjects is full", () => {
  const ready = questionsChecklist({
    missing: false,
    failed: false,
    perTopic: { Math: 2, Chinese: 2 },
    questions: [
      { subject: "Math", category: "Fractions" },
      { subject: "Math", category: "Fractions" },
      { subject: "Chinese", category: "成語" },
      { subject: "Chinese", category: "成語" },
      { subject: "Math", category: "Math" },
    ],
  });
  assert.equal(ready.done, true);
  assert.equal(ready.detail, "Math and Chinese have enough questions in every topic.");

  const short = questionsChecklist({
    missing: false,
    failed: false,
    perTopic: { Math: 2, Chinese: 2 },
    questions: [
      { subject: "Math", category: "Fractions" },
      { subject: "Math", category: "Decimals" },
      { subject: "Math", category: "Decimals" },
      { subject: "Chinese", category: "成語" },
      { subject: "Chinese", category: "成語" },
    ],
  });
  assert.equal(short.done, false);
  assert.equal(short.detail, "1 topic needs more questions.");

  const empty = questionsChecklist({
    missing: false,
    failed: false,
    perTopic: { Math: 2, Chinese: 2 },
    questions: [],
  });
  assert.equal(empty.detail, "Math and Chinese have no topics yet.");
  assert.equal(questionsChecklist({ missing: true, failed: false, perTopic: { Math: 2, Chinese: 2 }, questions: [] }).detail, "Waiting for a database update.");
});

test("a sitting warns only when it starts in the next 24 hours and is not prepared", () => {
  assert.equal(isStartInNext24Hours(hours(1), now), true);
  assert.equal(isStartInNext24Hours(hours(24), now), true);
  assert.equal(isStartInNext24Hours(hours(-1), now), false);
  assert.equal(isStartInNext24Hours(hours(25), now), false);
  assert.equal(isStartInNext24Hours(null, now), false);

  const warned = sittingsChecklist({
    missing: false,
    failed: false,
    nowMs: now,
    when: () => "tomorrow at 9:00",
    sittings: [
      { label: "Morning", startsAt: hours(20), prepared: false, locked: false },
      { label: "Afternoon", startsAt: hours(22), prepared: true, locked: false },
      { label: "Later", startsAt: hours(48), prepared: false, locked: false },
      { label: "Started", startsAt: hours(2), prepared: false, locked: true },
    ],
  });
  assert.equal(warned.done, false);
  assert.equal(warned.warn, true);
  assert.equal(
    warned.detail,
    "Morning starts tomorrow at 9:00 and the questions are not prepared.",
  );

  const ready = sittingsChecklist({
    missing: false,
    failed: false,
    nowMs: now,
    when: () => "soon",
    sittings: [{ label: "Morning", startsAt: hours(2), prepared: true, locked: false }],
  });
  assert.equal(ready.done, true);
  assert.equal(
    sittingsChecklist({ missing: false, failed: false, nowMs: now, when: () => "", sittings: [] }).detail,
    "No sittings yet.",
  );
});

test("the next exam is the earliest sitting still open, otherwise the newest exam", () => {
  assert.equal(
    nextExamId(
      [
        { examId: "later", endsAt: hours(5) },
        { examId: "soon", endsAt: hours(1) },
        { examId: "past", endsAt: hours(-1) },
      ],
      [{ id: "newest", createdAt: hours(0) }],
      now,
    ),
    "soon",
  );
  assert.equal(
    nextExamId(
      [{ examId: "past", endsAt: hours(-1) }],
      [
        { id: "older", createdAt: hours(-10) },
        { id: "newest", createdAt: hours(-1) },
      ],
      now,
    ),
    "newest",
  );
  assert.equal(nextExamId([], [], now), null);
});

test("QR codes are done only when every student has a code", () => {
  assert.equal(qrChecklist({ failed: false, hasExam: true, studentCount: 0, codedStudentCount: 0 }).href, "/admin/students");
  assert.equal(qrChecklist({ failed: false, hasExam: true, studentCount: 0, codedStudentCount: 0 }).action, "Add students");
  const none = qrChecklist({ failed: false, hasExam: true, studentCount: 4, codedStudentCount: 0 });
  assert.equal(none.done, false);
  assert.equal(none.detail, "No codes yet for the next sitting.");
  const some = qrChecklist({ failed: false, hasExam: true, studentCount: 4, codedStudentCount: 2 });
  assert.equal(some.detail, "Codes created for 2 of 4 students.");
  const all = qrChecklist({ failed: false, hasExam: true, studentCount: 4, codedStudentCount: 4 });
  assert.equal(all.done, true);
  assert.equal(all.detail, "Codes created for 4 students.");
});

test("results are done when nothing is waiting, and only the first gap is the solid button", () => {
  assert.equal(resultsChecklist({ failed: false, waiting: 0 }).done, true);
  assert.equal(resultsChecklist({ failed: false, waiting: 2 }).detail, "2 written answers waiting.");
  assert.equal(resultsChecklist({ failed: false, waiting: 1 }).detail, "1 written answer waiting.");

  const steps = markPrimary([
    questionsChecklist({
      missing: false,
      failed: false,
      perTopic: { Math: 2, Chinese: 2 },
      questions: [
        { subject: "Math", category: "Fractions" },
        { subject: "Math", category: "Fractions" },
        { subject: "Chinese", category: "成語" },
        { subject: "Chinese", category: "成語" },
      ],
    }),
    sittingsChecklist({ missing: false, failed: false, nowMs: now, when: () => "", sittings: [] }),
    qrChecklist({ failed: false, hasExam: false, studentCount: 1, codedStudentCount: 0 }),
    resultsChecklist({ failed: false, waiting: 0 }),
  ]);
  assert.deepEqual(
    steps.map((step) => step.primary),
    [false, true, false, false],
  );
});
