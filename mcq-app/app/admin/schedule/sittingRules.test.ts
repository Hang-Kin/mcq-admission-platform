import assert from "node:assert/strict";
import test from "node:test";

import { DELETE_CONFIRMATION, deleteTestDataSummary } from "./labels.ts";
import {
  activeSittings,
  archivedSittings,
  buildDayTimeline,
  canConfirmDelete,
  clashMessage,
  countStudents,
  defaultTimelineDay,
  existingOverlapWarning,
  findClashes,
  frozenMinutesMessage,
  sectionSourceText,
  sittingControls,
  subjectSettingsMessage,
  toHongKongDatetimeLocal,
  TOUCHING_BOUNDARIES_ALLOWED,
} from "./sittingRules.ts";

const morning = {
  id: "morning",
  label: "Morning",
  startsAt: "2026-11-02T02:00:00.000Z",
  endsAt: "2026-11-02T03:00:00.000Z",
  archivedAt: null,
};
const next = {
  id: "next",
  label: "Late morning",
  startsAt: "2026-11-02T03:00:00.000Z",
  endsAt: "2026-11-02T04:00:00.000Z",
  archivedAt: null,
};
const nested = {
  id: "nested",
  label: "Inside",
  startsAt: "2026-11-02T02:15:00.000Z",
  endsAt: "2026-11-02T02:45:00.000Z",
  archivedAt: null,
};
const overlap = {
  id: "overlap",
  label: "Overlap",
  startsAt: "2026-11-02T02:30:00.000Z",
  endsAt: "2026-11-02T03:30:00.000Z",
  archivedAt: null,
};

test("touching boundaries are allowed and nested slots clash", () => {
  assert.equal(TOUCHING_BOUNDARIES_ALLOWED, true);
  assert.deepEqual(findClashes(next, [morning]), []);
  assert.equal(clashMessage(next, [morning]), null);
  const nestedHit = findClashes(nested, [morning]);
  assert.equal(nestedHit.length, 1);
  assert.equal(clashMessage(nested, [morning]), "This time overlaps Morning.");
  assert.equal(
    clashMessage(overlap, [morning, next]),
    "This time overlaps Morning and Late morning.",
  );
});

test("archived sittings stay off the active list until the toggle asks for them", () => {
  const rows = [
    { id: "live", archivedAt: null },
    { id: "old", archivedAt: "2026-11-01T00:00:00.000Z" },
  ];
  assert.deepEqual(
    activeSittings(rows).map((row) => row.id),
    ["live"],
  );
  assert.deepEqual(
    archivedSittings(rows).map((row) => row.id),
    ["old"],
  );
  assert.equal(activeSittings(rows).some((row) => row.id === "old"), false);
});

test("a started sitting can be archived, and only an admin can delete its test data", () => {
  assert.deepEqual(
    sittingControls({
      locked: true,
      archived: false,
      isAdmin: false,
      canManage: true,
      archiveSupported: true,
    }),
    {
      archive: true,
      restore: false,
      deleteTime: false,
      deleteTestData: false,
      editTime: false,
    },
  );
  assert.deepEqual(
    sittingControls({
      locked: true,
      archived: false,
      isAdmin: true,
      canManage: true,
      archiveSupported: true,
    }),
    {
      archive: true,
      restore: false,
      deleteTime: false,
      deleteTestData: true,
      editTime: false,
    },
  );
  assert.equal(
    sittingControls({
      locked: false,
      archived: true,
      isAdmin: true,
      canManage: true,
      archiveSupported: true,
    }).restore,
    true,
  );
});

test("delete confirmation names the counts and accepts only DELETE", () => {
  assert.equal(
    deleteTestDataSummary({ students: 2, answers: 5, results: 1 }),
    "This will remove 2 students, 5 answers, and 1 result. The sitting is removed too. Type DELETE to confirm.",
  );
  assert.equal(canConfirmDelete(DELETE_CONFIRMATION), true);
  assert.equal(canConfirmDelete("delete"), false);
  assert.equal(canConfirmDelete(" DELETE"), false);
  assert.equal(canConfirmDelete("DELETE "), false);
  assert.equal(countStudents([{ studentId: "a" }, { studentId: "a" }, { studentId: null }]), 2);
});

test("frozen minutes say 7 and 8, and an open exam shows Subject settings", () => {
  assert.equal(
    frozenMinutesMessage([7, 8]),
    "Locked because students have started. Frozen at 7 and 8.",
  );
  assert.equal(
    subjectSettingsMessage({ Math: 8, Chinese: 8 }),
    "Subject settings: Math 8 minutes, Chinese 8 minutes.",
  );
  assert.match(subjectSettingsMessage(null), /Subject settings/);
});

test("a subject section hides the legacy question set name", () => {
  assert.equal(
    sectionSourceText({ subject: "Math", questionSet: "PreS1 Math Bank" }),
    "Questions are drawn from the Math question bank.",
  );
  assert.equal(
    sectionSourceText({ subject: "Chinese", questionSet: "S1 Chinese sample" }),
    "Questions are drawn from the Chinese question bank.",
  );
  assert.match(
    sectionSourceText({ subject: null, questionSet: "S1 Chinese sample" }),
    /S1 Chinese sample/,
  );
});

test("the day grid is Hong Kong time and marks overlaps, not touching edges", () => {
  assert.equal(toHongKongDatetimeLocal("2026-11-02T02:00:00.000Z"), "2026-11-02T10:00");
  const touching = buildDayTimeline({
    day: "2026-11-02",
    slots: [morning, next],
    clashSlots: [morning, next],
    draft: null,
  });
  assert.deepEqual(touching.hours, [10, 11]);
  assert.equal(touching.rows[0]?.blocks[0]?.overlaps, false);
  assert.equal(touching.rows[1]?.blocks[0]?.overlaps, false);
  assert.equal(touching.rows[0]?.blocks[0]?.href, "#sitting-morning");

  const clashing = buildDayTimeline({
    day: "2026-11-02",
    slots: [morning, overlap],
    clashSlots: [morning, overlap],
    draft: { startsAt: "2026-11-02T10:30", endsAt: "2026-11-02T11:15" },
  });
  assert.equal(clashing.rows.every((row) => row.blocks[0]?.overlaps), true);
  const draft = clashing.rows.find((row) => row.id === "draft");
  assert.equal(draft?.blocks[0]?.draft, true);
  assert.equal(draft?.blocks[0]?.href, null);

  const warning = existingOverlapWarning([morning, overlap, next]);
  assert.equal(warning, "Morning overlaps Overlap. Overlap overlaps Late morning.");
});

test("the default day prefers today, then the next sitting", () => {
  assert.equal(defaultTimelineDay(["2026-11-03", "2026-11-01"], "2026-11-02"), "2026-11-03");
  assert.equal(defaultTimelineDay(["2026-11-02"], "2026-11-02"), "2026-11-02");
  assert.equal(defaultTimelineDay([], "2026-11-02"), "2026-11-02");
});
