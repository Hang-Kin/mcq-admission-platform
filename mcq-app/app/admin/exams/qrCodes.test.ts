import assert from "node:assert/strict";
import test from "node:test";

import { createPendingQrCodes, qrCreateDecision } from "./qrCodes.ts";

test("a fresh intake with no sitting is created, and a started sitting is skipped", () => {
  assert.equal(qrCreateDecision(null), "create");
  assert.equal(qrCreateDecision({ status: "pending" }), "create");
  assert.equal(qrCreateDecision({ status: "in_progress" }), "skip_started");
  assert.equal(qrCreateDecision({ status: "submitted" }), "skip_started");
});

function fakeClient(existing: { id: string; status: string } | null) {
  const upserts: Array<Record<string, unknown>> = [];
  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: existing, error: null }),
                  };
                },
              };
            },
          };
        },
        upsert(row: Record<string, unknown>) {
          upserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { supabase, upserts };
}

test("creating codes on a fresh intake still writes a pending code", async () => {
  const { supabase, upserts } = fakeClient(null);
  const batch = await createPendingQrCodes(supabase as never, {
    examId: "exam-1",
    studentIds: ["student-fresh"],
    assignedQuestionIds: ["question-1"],
    expiresAt: "2026-10-01T00:00:00.000Z",
  });
  assert.equal(batch.skippedStarted, 0);
  assert.equal(batch.skippedFailed, 0);
  assert.equal(batch.created.length, 1);
  assert.equal(batch.created[0]?.studentId, "student-fresh");
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0]?.student_id, "student-fresh");
  assert.equal(upserts[0]?.exam_id, "exam-1");
  assert.equal(upserts[0]?.status, "pending");
  assert.equal(typeof upserts[0]?.access_token, "string");
  assert.ok(String(upserts[0]?.access_token).length > 0);
});

test("a student who already started does not get a new code", async () => {
  const { supabase, upserts } = fakeClient({ id: "instance-1", status: "in_progress" });
  const batch = await createPendingQrCodes(supabase as never, {
    examId: "exam-1",
    studentIds: ["student-started"],
    assignedQuestionIds: [],
    expiresAt: "2026-10-01T00:00:00.000Z",
  });
  assert.equal(batch.created.length, 0);
  assert.equal(batch.skippedStarted, 1);
  assert.equal(upserts.length, 0);
});
