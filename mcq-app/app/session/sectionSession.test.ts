import assert from "node:assert/strict";
import test from "node:test";

import {
  countdownEndsAtMs,
  finishSectionConfirmCopy,
  interpretAdvancePayload,
  questionsAfterAdvance,
  readSection,
  sectionFromPayload,
  shouldAutoAdvance,
  shouldAutoSubmitExam,
  SECTION_LOCKED_MESSAGE,
} from "./[token]/sectionSession.ts";

test("a payload without a section stays on the exam timer", () => {
  assert.equal(sectionFromPayload({ ok: true, expires_at: "2026-09-27T11:00:00.000Z" }), null);
  assert.equal(sectionFromPayload({ ok: true, section: null }), null);
  assert.equal(countdownEndsAtMs(null, 1234), 1234);
  assert.equal(shouldAutoSubmitExam(null, 0), true);
  assert.equal(shouldAutoAdvance(null, 0), false);
});

test("section countdown uses the section end and replaces the exam timer", () => {
  const section = readSection({
    id: "sec-a",
    label: "Section A",
    position: 0,
    question_set: "Algebra",
    ends_at: "2026-09-27T10:15:00.000Z",
  });
  assert.ok(section);
  assert.equal(
    countdownEndsAtMs(section, Date.parse("2026-09-27T12:00:00.000Z")),
    Date.parse("2026-09-27T10:15:00.000Z"),
  );
  assert.equal(shouldAutoAdvance(section, 0), true);
  assert.equal(shouldAutoSubmitExam(section, 0), false);
  assert.equal(shouldAutoAdvance(section, 1), false);
});

test("section end can be started_at plus duration", () => {
  const fromMinutes = readSection({
    label: "Section A",
    started_at: "2026-09-27T10:00:00.000Z",
    duration_minutes: 15,
  });
  const fromAlias = readSection({
    label: "Section B",
    section_started_at: "2026-09-27T10:00:00.000Z",
    duration: 10,
  });
  assert.equal(fromMinutes?.endsAtMs, Date.parse("2026-09-27T10:15:00.000Z"));
  assert.equal(fromAlias?.endsAtMs, Date.parse("2026-09-27T10:10:00.000Z"));
});

test("finish confirmation uses the section label verbatim", () => {
  assert.equal(
    finishSectionConfirmCopy("Section A"),
    "Confirm finishing Section A? You may not come back to review your answers in Section A.",
  );
});

test("section.is_last does not finish the exam", () => {
  const result = interpretAdvancePayload(
    {
      ok: true,
      is_last: false,
      status: "in_progress",
      section: {
        index: 1,
        position: 1,
        label: "Section B",
        is_last: true,
        ends_at: "2026-09-27T11:00:00.000Z",
      },
      questions: [{ id: "q-b", question_set: "B" }],
    },
    null,
  );
  assert.equal(result.type, "section");
  if (result.type !== "section") return;
  assert.equal(result.section.label, "Section B");
});

test("is_last shows completion even if a section object is also present", () => {
  const result = interpretAdvancePayload(
    {
      ok: true,
      is_last: true,
      section: { label: "Section B", ends_at: "2026-09-27T11:00:00.000Z" },
    },
    null,
  );
  assert.deepEqual(result, { type: "submitted" });
});

test("advance adopts the section the server returns", () => {
  const result = interpretAdvancePayload(
    {
      ok: true,
      is_last: false,
      section: {
        id: "sec-c",
        label: "Section C",
        position: 2,
        ends_at: "2026-09-27T11:00:00.000Z",
        question_set: "Geometry",
      },
      questions: [{ id: "q2", question_set: "Geometry" }],
    },
    null,
  );
  assert.equal(result.type, "section");
  if (result.type !== "section") return;
  assert.equal(result.section.label, "Section C");
  assert.equal(result.section.position, 2);
  assert.deepEqual(result.questions, [{ id: "q2", question_set: "Geometry" }]);
});

test("already submitted from advance is the completion state", () => {
  assert.deepEqual(
    interpretAdvancePayload({ ok: false, error: "already_submitted" }, null),
    { type: "submitted" },
  );
});

test("section_locked is a soft message", () => {
  assert.deepEqual(
    interpretAdvancePayload(
      null,
      { message: "section_locked" },
    ),
    { type: "soft", message: SECTION_LOCKED_MESSAGE },
  );
});

test("section index comes from the server section object", () => {
  const section = readSection({
    label: "Section A",
    index: 0,
    position: 0,
    ends_at: "2026-09-27T10:15:00.000Z",
  });
  assert.equal(section?.index, 0);
  assert.equal(section?.position, 0);
});

test("a stale advance reloads instead of skipping a section", () => {
  assert.deepEqual(
    interpretAdvancePayload({ ok: false, error: "section_mismatch" }, null),
    { type: "resync" },
  );
  assert.deepEqual(
    interpretAdvancePayload({ ok: false, error: "not_sectioned" }, null),
    { type: "resync" },
  );
});

test("already advanced returns the section the server is on", () => {
  const result = interpretAdvancePayload(
    {
      ok: true,
      is_last: false,
      already_advanced: true,
      section: {
        index: 1,
        position: 1,
        label: "Section B",
        ends_at: "2026-09-27T10:30:00.000Z",
        question_set: "B",
      },
      questions: [{ id: "q-b", question_set: "B" }],
    },
    null,
  );
  assert.equal(result.type, "section");
  if (result.type !== "section") return;
  assert.equal(result.section.index, 1);
  assert.equal(result.section.label, "Section B");
});

test("invalid session still blocks the exam", () => {
  assert.deepEqual(
    interpretAdvancePayload({ ok: false, error: "invalid_session_id" }, null),
    { type: "blocked", code: "invalid_session_id" },
  );
});

test("missing questions on advance filters by the server question set", () => {
  const section = readSection({
    label: "Section B",
    question_set: "B",
    ends_at: "2026-09-27T11:00:00.000Z",
  });
  assert.ok(section);
  const next = questionsAfterAdvance(
    [
      { id: "1", question_set: "A" },
      { id: "2", question_set: "B" },
    ],
    undefined,
    section,
  );
  assert.deepEqual(next, [{ id: "2", question_set: "B" }]);
});

test("an explicit question list replaces the previous section", () => {
  const section = readSection({
    label: "Section B",
    question_set: "B",
    ends_at: "2026-09-27T11:00:00.000Z",
  });
  assert.ok(section);
  const next = questionsAfterAdvance(
    [{ id: "1", question_set: "A" }],
    [],
    section,
  );
  assert.deepEqual(next, []);
});
