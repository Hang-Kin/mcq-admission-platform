import assert from "node:assert/strict";
import test from "node:test";

import {
  cellsFromFormEntries,
  planSectionTimeslotQuestionSets,
  sectionTimeslotCellKey,
} from "./sectionTimeslotOverrides.ts";

const slot = "11111111-1111-1111-1111-111111111111";
const sectionA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const sectionB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

test("a blank cell with no saved row is not written", () => {
  const plan = planSectionTimeslotQuestionSets(
    [
      { timeslotId: slot, sectionId: sectionA, questionSet: "  " },
      { timeslotId: slot, sectionId: sectionB, questionSet: "" },
    ],
    [],
  );
  assert.deepEqual(plan, { upserts: [], clears: [] });
});

test("a filled cell is saved and a cleared cell is removed", () => {
  const plan = planSectionTimeslotQuestionSets(
    [
      {
        timeslotId: slot,
        sectionId: sectionA,
        questionSet: " Interview Set 03 ",
      },
      { timeslotId: slot, sectionId: sectionB, questionSet: "" },
    ],
    [
      {
        timeslotId: slot,
        sectionId: sectionB,
        questionSet: "Chinese Set 01",
      },
    ],
  );
  assert.deepEqual(plan.upserts, [
    {
      timeslotId: slot,
      sectionId: sectionA,
      questionSet: "Interview Set 03",
    },
  ]);
  assert.deepEqual(plan.clears, [
    { timeslotId: slot, sectionId: sectionB },
  ]);
});

test("an unchanged set is left alone", () => {
  const plan = planSectionTimeslotQuestionSets(
    [{ timeslotId: slot, sectionId: sectionA, questionSet: "Interview Set 03" }],
    [
      {
        timeslotId: slot,
        sectionId: sectionA,
        questionSet: "Interview Set 03",
      },
    ],
  );
  assert.deepEqual(plan, { upserts: [], clears: [] });
});

test("form keys round-trip to timeslot and section ids", () => {
  const parsed = cellsFromFormEntries([
    [sectionTimeslotCellKey(slot, sectionA), "Interview Set 03"],
    ["exam_id", "exam"],
  ]);
  assert.deepEqual(parsed, [
    {
      timeslotId: slot,
      sectionId: sectionA,
      questionSet: "Interview Set 03",
    },
  ]);
});
