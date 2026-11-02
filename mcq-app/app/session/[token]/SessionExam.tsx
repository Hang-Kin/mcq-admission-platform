"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

import { ExamChrome } from "./ExamChrome";
import type { SessionQuestion } from "./examProgress";
import { fractionAnswer, readFractionParts } from "./fractionAnswer";
import { autosaveStatusLabel, examLabels } from "./labels.js";
import {
  countdownEndsAtMs,
  interpretAdvancePayload,
  questionsAfterAdvance,
  sectionFromIndex,
  sectionFromPayload,
  sectionKey,
  shouldAutoAdvance,
  shouldAutoSubmitExam,
  SECTION_LOCKED_MESSAGE,
  type ExamSectionState,
} from "./sectionSession";

type RpcErrorCode = keyof typeof examLabels.errors;

type StartSessionSuccess = {
  ok: true;
  instance_id: string;
  exam_id: string;
  expires_at: string;
  status: string;
  session_id: string;
  questions: SessionQuestion[];
  section?: unknown;
  is_last?: boolean;
};

type RpcFailure = {
  ok: false;
  error: string;
};

type AutosaveState = "idle" | "saving" | "saved" | "error";

const statusFrame =
  "-mx-5 -my-10 flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-5 py-10 sm:-mx-8 sm:px-8";

function classifyError(code: string | undefined): RpcErrorCode {
  switch (code) {
    case "invalid_token":
    case "expired":
    case "already_submitted":
    case "session_already_active":
    case "not_in_progress":
    case "question_not_assigned":
    case "invalid_session_id":
    case "invalid_sections":
    case "not_prepared":
      return code;
    default:
      return "unknown";
  }
}

function parseRpcPayload(data: unknown): StartSessionSuccess | RpcFailure | null {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { ok?: unknown };
  if (record.ok === true || record.ok === false) {
    return value as StartSessionSuccess | RpcFailure;
  }
  return null;
}

function extractErrorCode(
  payload: RpcFailure | null,
  rpcError: { message?: string; details?: string } | null,
): string | undefined {
  if (payload?.error) return payload.error;
  const blob = `${rpcError?.message ?? ""} ${rpcError?.details ?? ""}`;
  const match = blob.match(
    /not_prepared|invalid_sections|invalid_token|expired|already_submitted|session_already_active|not_in_progress|question_not_assigned|invalid_session_id|section_locked/,
  );
  return match?.[0];
}

function formatRemaining(ms: number) {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function measureClockOffsetMs(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return 0;
  try {
    const t0 = Date.now();
    const response = await Promise.race([
      fetch(url, { method: "HEAD" }),
      new Promise<Response>((_, reject) => {
        window.setTimeout(() => reject(new Error("clock_offset_timeout")), 1500);
      }),
    ]);
    const t1 = Date.now();
    const dateHeader = response.headers.get("date");
    if (!dateHeader) return 0;
    const serverNow = new Date(dateHeader).getTime();
    if (Number.isNaN(serverNow)) return 0;
    const localMid = (t0 + t1) / 2;
    return serverNow - localMid;
  } catch {
    return 0;
  }
}

export function SessionExam({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), []);
  const sessionIdRef = useRef<string | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const examStoppedRef = useRef(false);
  const advancingRef = useRef(false);
  const sectionKeyRef = useRef<string | null>(null);
  const sectionIndexRef = useRef<number | null>(null);
  const autoAdvanceKeyRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [blockingError, setBlockingError] = useState<RpcErrorCode | null>(null);
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fractionDrafts, setFractionDrafts] = useState<
    Record<string, { numerator: string; denominator: string }>
  >({});
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [currentSection, setCurrentSection] = useState<ExamSectionState | null>(
    null,
  );
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [autosave, setAutosave] = useState<AutosaveState>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [sectionNotice, setSectionNotice] = useState<string | null>(null);

  const stopExam = useCallback((code: RpcErrorCode) => {
    examStoppedRef.current = true;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setBlockingError(code);
    setConfirmOpen(false);
    setFinishConfirmOpen(false);
  }, []);

  const timerEndsAtMs = countdownEndsAtMs(currentSection, expiresAtMs);
  const remainingMs =
    timerEndsAtMs === null ? null : timerEndsAtMs - (nowMs + clockOffsetMs);

  const adoptServerSection = useCallback(
    (section: ExamSectionState, incoming: SessionQuestion[] | undefined) => {
      const nextKey = sectionKey(section);
      const changed = sectionKeyRef.current !== nextKey;
      sectionKeyRef.current = nextKey;
      sectionIndexRef.current = sectionFromIndex(section);
      setCurrentSection(section);
      setExpiresAtMs(null);
      setQuestions((current) =>
        questionsAfterAdvance(current, incoming),
      );
      if (changed) {
        setIndex(0);
        setAutosave("idle");
      }
      setFinishConfirmOpen(false);
      setNowMs(Date.now());
    },
    [],
  );

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setLoading(true);
      const offsetPromise = measureClockOffsetMs();
      const { data, error } = await supabase.rpc("start_session", {
        p_token: token,
        p_session_id: null,
      });
      const offset = await offsetPromise;
      if (cancelled) return;

      const payload = parseRpcPayload(data);
      if (error || !payload || payload.ok === false) {
        stopExam(
          classifyError(
            extractErrorCode(
              payload && payload.ok === false ? payload : null,
              error,
            ),
          ),
        );
        setLoading(false);
        return;
      }

      sessionIdRef.current = payload.session_id;
      const startedSection = sectionFromPayload(payload);
      if (startedSection) {
        adoptServerSection(startedSection, payload.questions ?? []);
      } else {
        sectionKeyRef.current = null;
        sectionIndexRef.current = null;
        setCurrentSection(null);
        setQuestions(payload.questions ?? []);
        setExpiresAtMs(new Date(payload.expires_at).getTime());
      }
      setClockOffsetMs(offset);
      setNowMs(Date.now());
      setLoading(false);
    }

    void start();

    return () => {
      cancelled = true;
    };
  }, [adoptServerSection, stopExam, supabase, token]);

  useEffect(() => {
    if (loading || blockingError || submitted || timerEndsAtMs === null) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [blockingError, loading, submitted, timerEndsAtMs]);

  const submitExam = useCallback(
    async () => {
      if (submittingRef.current || examStoppedRef.current || submitted) return;
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;

      submittingRef.current = true;
      setSubmitBusy(true);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      const { data, error } = await supabase.rpc("submit_exam", {
        p_token: token,
        p_session_id: sessionId,
      });
      const payload = parseRpcPayload(data);

      if (error || (payload && payload.ok === false)) {
        stopExam(
          classifyError(
            extractErrorCode(
              payload && payload.ok === false ? payload : null,
              error,
            ),
          ),
        );
        submittingRef.current = false;
        setSubmitBusy(false);
        return;
      }

      setSubmitted(true);
      setConfirmOpen(false);
      setSubmitBusy(false);
      submittingRef.current = false;
    },
    [stopExam, submitted, supabase, token],
  );

  useEffect(() => {
    if (!shouldAutoSubmitExam(currentSection, remainingMs)) return;
    if (loading || blockingError || submitted) return;
    void submitExam();
  }, [blockingError, currentSection, loading, remainingMs, submitExam, submitted]);

  const resyncSession = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || examStoppedRef.current) return;

    const { data, error } = await supabase.rpc("start_session", {
      p_token: token,
      p_session_id: sessionId,
    });
    if (examStoppedRef.current) return;

    const payload = parseRpcPayload(data);
    if (payload && payload.ok === true) {
      if (payload.status === "submitted" || payload.is_last === true) {
        setSubmitted(true);
        return;
      }
      const nextSection = sectionFromPayload(payload);
      if (nextSection) {
        adoptServerSection(nextSection, payload.questions ?? []);
        return;
      }
      sectionKeyRef.current = null;
      sectionIndexRef.current = null;
      setCurrentSection(null);
      setQuestions(payload.questions ?? []);
      setExpiresAtMs(new Date(payload.expires_at).getTime());
      setNowMs(Date.now());
      return;
    }

    const code = extractErrorCode(
      payload && payload.ok === false ? payload : null,
      error,
    );
    if (code === "already_submitted") {
      setSubmitted(true);
      return;
    }
    if (code === "section_locked") return;
    const classified = classifyError(code);
    if (classified !== "unknown") stopExam(classified);
  }, [adoptServerSection, stopExam, supabase, token]);

  const advanceSection = useCallback(async () => {
    if (
      advancingRef.current ||
      submittingRef.current ||
      examStoppedRef.current ||
      submitted
    ) {
      return;
    }
    const sessionId = sessionIdRef.current;
    const fromIndex = sectionIndexRef.current;
    if (!sessionId || fromIndex === null) return;

    advancingRef.current = true;
    setAdvanceBusy(true);
    setFinishConfirmOpen(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const { data, error } = await supabase.rpc("advance_section", {
      p_token: token,
      p_session_id: sessionId,
      p_from_index: fromIndex,
    });

    if (examStoppedRef.current) {
      advancingRef.current = false;
      setAdvanceBusy(false);
      return;
    }

    const interpreted = interpretAdvancePayload(data, error);
    if (interpreted.type === "submitted") {
      setSubmitted(true);
      setConfirmOpen(false);
      setFinishConfirmOpen(false);
      advancingRef.current = false;
      setAdvanceBusy(false);
      return;
    }

    if (interpreted.type === "section") {
      const incoming = Array.isArray(interpreted.questions)
        ? interpreted.questions.filter(
            (item): item is SessionQuestion =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as SessionQuestion).id === "string",
          )
        : undefined;
      adoptServerSection(interpreted.section, incoming);
      advancingRef.current = false;
      setAdvanceBusy(false);
      return;
    }

    if (interpreted.type === "blocked") {
      stopExam(interpreted.code);
      advancingRef.current = false;
      setAdvanceBusy(false);
      return;
    }

    if (interpreted.type === "resync") {
      advancingRef.current = false;
      setAdvanceBusy(false);
      await resyncSession();
      return;
    }

    setSectionNotice(interpreted.message);
    advancingRef.current = false;
    setAdvanceBusy(false);
  }, [adoptServerSection, resyncSession, stopExam, submitted, supabase, token]);

  useEffect(() => {
    if (!shouldAutoAdvance(currentSection, remainingMs)) return;
    if (loading || blockingError || submitted || !currentSection) return;
    const key = `${sectionKey(currentSection)}:${currentSection.endsAtMs}`;
    if (autoAdvanceKeyRef.current === key) return;
    autoAdvanceKeyRef.current = key;
    void advanceSection();
  }, [
    advanceSection,
    blockingError,
    currentSection,
    loading,
    remainingMs,
    submitted,
  ]);

  const saveAnswer = useCallback(
    (questionId: string, value: string) => {
      if (examStoppedRef.current || submitted) return;
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setAutosave("saving");
      debounceRef.current = setTimeout(async () => {
        const { data, error } = await supabase.rpc("submit_answer", {
          p_token: token,
          p_session_id: sessionId,
          p_question_id: questionId,
          p_answer: value,
        });
        const payload = parseRpcPayload(data);
        if (examStoppedRef.current) return;
        if (error || !payload || payload.ok === false) {
          const rawCode = extractErrorCode(
            payload && payload.ok === false ? payload : null,
            error,
          );
          if (rawCode === "section_locked") {
            setSectionNotice(SECTION_LOCKED_MESSAGE);
            setAutosave("idle");
            void resyncSession();
            return;
          }
          if (rawCode === "expired" && sectionIndexRef.current !== null) {
            setSubmitted(true);
            setAutosave("idle");
            return;
          }
          const code = classifyError(rawCode);
          if (
            code === "invalid_token" ||
            code === "expired" ||
            code === "already_submitted" ||
            code === "session_already_active" ||
            code === "not_in_progress" ||
            code === "question_not_assigned" ||
            code === "invalid_session_id"
          ) {
            stopExam(code);
            return;
          }
          setAutosave("error");
          return;
        }
        setSectionNotice(null);
        setAutosave("saved");
      }, 800);
    },
    [resyncSession, stopExam, submitted, supabase, token],
  );

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    saveAnswer(questionId, value);
  }

  const question = questions[index];
  const total = questions.length;

  function goToQuestion(next: number) {
    if (advanceBusy || submitBusy) return;
    const last = Math.max(0, total - 1);
    setFinishConfirmOpen(false);
    setConfirmOpen(false);
    setIndex(Math.min(last, Math.max(0, next)));
  }

  if (loading) {
    return (
      <main className={statusFrame}>
        <p className="text-base text-muted-foreground">{examLabels.opening}</p>
      </main>
    );
  }

  if (blockingError) {
    const copy = examLabels.errors[blockingError];
    return (
      <main className={statusFrame}>
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className={copy.body ? "text-xl leading-snug" : "text-xl leading-normal"}>
              {copy.title}
            </CardTitle>
            {copy.body ? (
              <CardDescription className="text-base leading-relaxed">
                {copy.body}
              </CardDescription>
            ) : null}
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className={statusFrame}>
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-xl leading-snug">{examLabels.submittedTitle}</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              {examLabels.submittedBody}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!question || total === 0) {
    return (
      <main className={statusFrame}>
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-xl leading-snug">{examLabels.noQuestionsTitle}</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              {examLabels.noQuestionsBody}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const value = answers[question.id] ?? "";
  const fractionParts =
    fractionDrafts[question.id] ?? readFractionParts(value);
  const fractionCheck =
    question.type === "fraction"
      ? fractionAnswer(fractionParts.numerator, fractionParts.denominator)
      : null;

  function changeFraction(part: "numerator" | "denominator", next: string) {
    const numerator = part === "numerator" ? next : fractionParts.numerator;
    const denominator = part === "denominator" ? next : fractionParts.denominator;
    setFractionDrafts((current) => ({
      ...current,
      [question.id]: { numerator, denominator },
    }));
    const result = fractionAnswer(numerator, denominator);
    if (result.ok) {
      const saved = readFractionParts(result.answer);
      setFractionDrafts((current) => ({
        ...current,
        [question.id]: saved,
      }));
      setAnswers((current) => ({ ...current, [question.id]: result.answer }));
      saveAnswer(question.id, result.answer);
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setAutosave("idle");
  }

  return (
    <ExamChrome
      questions={questions}
      index={index}
      answers={answers}
      section={currentSection}
      remainingLabel={
        remainingMs === null ? examLabels.timerPlaceholder : formatRemaining(remainingMs)
      }
      autosaveLabel={autosaveStatusLabel(autosave)}
      sectionNotice={sectionNotice}
      advanceBusy={advanceBusy}
      submitBusy={submitBusy}
      finishConfirmOpen={finishConfirmOpen}
      submitConfirmOpen={confirmOpen}
      fraction={{
        numerator: fractionParts.numerator,
        denominator: fractionParts.denominator,
        message: fractionCheck && !fractionCheck.ok ? fractionCheck.message : null,
      }}
      onSelectQuestion={goToQuestion}
      onPrevious={() => goToQuestion(index - 1)}
      onNext={() => goToQuestion(index + 1)}
      onAnswer={updateAnswer}
      onFractionPart={changeFraction}
      onOpenFinish={() => setFinishConfirmOpen(true)}
      onOpenSubmit={() => setConfirmOpen(true)}
      onCancelFinish={() => setFinishConfirmOpen(false)}
      onCancelSubmit={() => setConfirmOpen(false)}
      onConfirmFinish={() => void advanceSection()}
      onConfirmSubmit={() => void submitExam()}
    />
  );
}
