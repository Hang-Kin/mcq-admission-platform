import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

import { bindExamLeaveGuard } from "./[token]/examLeaveGuard.ts";
import {
  clampQuestionIndex,
  clearResumeStorage,
  examLeaveGuardActive,
  readQuestionPlace,
  readSessionId,
  resumeClearReason,
  resumeStorageKeys,
  restoredQuestionIndex,
  savedAnswersFromPayload,
  sessionIdStorageKey,
  startSessionArgs,
  startSessionOnce,
  writeQuestionPlace,
  writeSessionId,
} from "./[token]/sessionResume.ts";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test("session id is stored per token and cleared with the question place", () => {
  const local = memoryStorage();
  const session = memoryStorage();
  assert.equal(sessionIdStorageKey("tok-a"), "mcq-session:tok-a");
  assert.deepEqual(resumeStorageKeys("tok-a"), [
    "mcq-session:tok-a",
    "mcq-question:tok-a",
  ]);
  assert.equal(resumeStorageKeys("tok-a").some((key) => key.includes("expires")), false);

  writeSessionId(local, "tok-a", "sess-1");
  writeSessionId(local, "tok-b", "sess-2");
  writeQuestionPlace(session, "tok-a", null, 2);
  assert.equal(readSessionId(local, "tok-a"), "sess-1");
  assert.equal(readSessionId(local, "tok-b"), "sess-2");
  assert.equal(readSessionId(local, "tok-missing"), null);

  clearResumeStorage(local, session, "tok-a");
  assert.equal(readSessionId(local, "tok-a"), null);
  assert.equal(readQuestionPlace(session, "tok-a", null), null);
  assert.equal(readSessionId(local, "tok-b"), "sess-2");
});

test("blank session ids are not stored", () => {
  const local = memoryStorage();
  writeSessionId(local, "tok", "   ");
  assert.equal(readSessionId(local, "tok"), null);
  local.setItem(sessionIdStorageKey("tok"), "  ");
  assert.equal(readSessionId(local, "tok"), null);
});

test("reload resumes with the stored session id", () => {
  const local = memoryStorage();
  writeSessionId(local, "tok", "sess-1");
  assert.deepEqual(startSessionArgs(readSessionId(local, "tok")), {
    p_session_id: "sess-1",
  });
  assert.deepEqual(startSessionArgs(null), { p_session_id: null });
});

test("overlapping opens share one start_session call", async () => {
  let calls = 0;
  const call = () => {
    calls += 1;
    return new Promise((resolve) => {
      setTimeout(() => resolve({ data: { ok: true, session_id: "sess-1" }, error: null }), 30);
    });
  };
  const [first, second] = await Promise.all([
    startSessionOnce("tok", null, call),
    startSessionOnce("tok", null, call),
  ]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  let otherCalls = 0;
  await startSessionOnce("tok", "sess-1", () => {
    otherCalls += 1;
    return Promise.resolve({ data: { ok: true }, error: null });
  });
  assert.equal(otherCalls, 1);
});

test("a rejected stored id is kept and is not replaced with null", () => {
  const local = memoryStorage();
  const session = memoryStorage();
  writeSessionId(local, "tok", "sess-1");
  writeQuestionPlace(session, "tok", null, 1);
  assert.equal(resumeClearReason({ error: "session_already_active" }), null);
  assert.equal(resumeClearReason({ error: "invalid_session_id" }), null);
  assert.equal(readSessionId(local, "tok"), "sess-1");
  assert.deepEqual(startSessionArgs(readSessionId(local, "tok")), {
    p_session_id: "sess-1",
  });
  assert.equal(readQuestionPlace(session, "tok", null), 1);
});

test("submitted, expired, and already submitted clear the stored id", () => {
  for (const input of [
    { submitted: true },
    { status: "submitted" },
    { error: "expired" },
    { error: "already_submitted" },
  ]) {
    const local = memoryStorage();
    const session = memoryStorage();
    writeSessionId(local, "tok", "sess-1");
    writeQuestionPlace(session, "tok", "index:0", 4);
    assert.notEqual(resumeClearReason(input), null);
    if (resumeClearReason(input)) clearResumeStorage(local, session, "tok");
    assert.equal(readSessionId(local, "tok"), null);
    assert.equal(readQuestionPlace(session, "tok", "index:0"), null);
  }
});

test("saved answers restore strings for this payload and drop the answer key", () => {
  assert.equal(savedAnswersFromPayload({ ok: true, questions: [] }), null);
  assert.deepEqual(
    savedAnswersFromPayload({
      saved_answers: { q1: "4", q2: "0", correct_answer: "9", is_correct: "true" },
      correct_answer: "hidden",
      access_token: "secret",
    }),
    { q1: "4", q2: "0" },
  );
  assert.deepEqual(
    savedAnswersFromPayload({
      saved_answers: { q1: 4, q2: { correct_answer: "9" }, q3: null },
    }),
    {},
  );
  assert.deepEqual(savedAnswersFromPayload({ saved_answers: null }), {});
});

test("question index is kept for the same section and clamped", () => {
  const session = memoryStorage();
  writeQuestionPlace(session, "tok", null, 2);
  assert.equal(readQuestionPlace(session, "tok", null), 2);
  assert.equal(readQuestionPlace(session, "tok", "index:0"), null);
  writeQuestionPlace(session, "tok", "index:1", 5);
  assert.equal(restoredQuestionIndex(session, "tok", "index:1", 3), 2);
  assert.equal(restoredQuestionIndex(session, "tok", "index:0", 3), 0);
  assert.equal(clampQuestionIndex(-3, 4), 0);
  assert.equal(clampQuestionIndex(9, 0), 0);
});

test("the leave guard is on only while the exam is in progress", () => {
  assert.equal(
    examLeaveGuardActive({
      loading: false,
      blockingError: false,
      submitted: false,
      questionCount: 3,
    }),
    true,
  );
  assert.equal(
    examLeaveGuardActive({
      loading: true,
      blockingError: false,
      submitted: false,
      questionCount: 3,
    }),
    false,
  );
  assert.equal(
    examLeaveGuardActive({
      loading: false,
      blockingError: true,
      submitted: false,
      questionCount: 3,
    }),
    false,
  );
  assert.equal(
    examLeaveGuardActive({
      loading: false,
      blockingError: false,
      submitted: true,
      questionCount: 3,
    }),
    false,
  );
});

test("Back stays on the exam and leaving asks the browser", () => {
  const dom = new Window({ url: "http://localhost:3000/left" });
  const target = dom as unknown as Window;
  target.history.pushState({}, "", "http://localhost:3000/session/tok");
  const release = bindExamLeaveGuard(target, true);
  const leave = new dom.Event("beforeunload", { cancelable: true });
  assert.equal(target.dispatchEvent(leave), false);
  assert.equal(leave.defaultPrevented, true);

  target.history.back();
  target.history.back();
  assert.equal(target.location.pathname, "/session/tok");

  release();
  const after = new dom.Event("beforeunload", { cancelable: true });
  assert.equal(target.dispatchEvent(after), true);
  dom.close();
});

test("an inactive exam does not trap Back", () => {
  const dom = new Window({ url: "http://localhost:3000/session/tok" });
  const target = dom as unknown as Window;
  target.history.pushState({}, "", "http://localhost:3000/admin");
  const release = bindExamLeaveGuard(target, false);
  target.history.back();
  assert.equal(target.location.pathname, "/session/tok");
  release();
  dom.close();
});

test("the exam screen resumes from storage and still times from the server", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./[token]/SessionExam.tsx", import.meta.url)),
    "utf8",
  );
  assert.match(source, /startSessionArgs\(storedSessionId\)/);
  assert.equal(source.includes("p_session_id: null"), false);
  assert.match(source, /new Date\(payload\.expires_at\)/);
  assert.match(source, /bindExamLeaveGuard/);
  assert.match(source, /savedAnswersFromPayload/);
});

test("migration 030 is unapplied and does not return the answer key", () => {
  const sql = readFileSync(
    fileURLToPath(new URL("../../../migrations/migration_030_resume_saved_answers.sql", import.meta.url)),
    "utf8",
  );
  assert.match(sql, /UNAPPLIED/);
  assert.match(sql, /HIGH RISK/);
  assert.match(sql, /'saved_answers', v_saved_answers/);
  assert.match(sql, /r\.student_answer/);
  assert.match(sql, /revoke execute on function start_session\(text, text\) from public/);
  assert.match(sql, /revoke execute on function start_session\(text, text\) from authenticated/);
  assert.match(sql, /grant execute on function start_session\(text, text\) to anon/);
  assert.equal(sql.includes("correct_answer"), false);
  assert.equal(sql.includes("r.is_correct"), false);
  assert.equal(sql.includes("grant execute on function start_session(text, text) to authenticated"), false);
  assert.equal(sql.includes("grant execute on function start_session(text, text) to public"), false);
});
