"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type QuestionType = "radio" | "numeric" | "text";

type SessionQuestion = {
  id: string;
  question_text: string;
  type: QuestionType | string;
  options: unknown;
  category: string;
  question_set: string;
};

type RpcErrorCode =
  | "invalid_token"
  | "expired"
  | "already_submitted"
  | "session_already_active"
  | "not_in_progress"
  | "question_not_assigned"
  | "invalid_session_id"
  | "unknown";

type StartSessionSuccess = {
  ok: true;
  instance_id: string;
  exam_id: string;
  expires_at: string;
  status: string;
  session_id: string;
  questions: SessionQuestion[];
};

type RpcFailure = {
  ok: false;
  error: string;
};

type AutosaveState = "idle" | "saving" | "saved" | "error";

const ERROR_COPY: Record<RpcErrorCode, { title: string; body: string }> = {
  invalid_token: {
    title: "This link is invalid",
    body: "The exam link you used is not recognised. Check the QR code or ask a teacher for a new link.",
  },
  expired: {
    title: "This exam has expired",
    body: "The time allowed for this exam has ended. You can no longer start or continue it.",
  },
  already_submitted: {
    title: "This exam has already been submitted",
    body: "Your answers have already been recorded. You cannot open this exam again.",
  },
  session_already_active: {
    title: "This exam is already open on another device",
    body: "This sitting is locked to the device that opened it first. Close that session, or ask a teacher if you need to switch devices.",
  },
  not_in_progress: {
    title: "This exam is no longer in progress",
    body: "The sitting is not active, so answers cannot be saved. Refresh only if a teacher asks you to.",
  },
  question_not_assigned: {
    title: "This question is not part of your exam",
    body: "The question you tried to answer is not in your assigned set. The exam has been stopped.",
  },
  invalid_session_id: {
    title: "This session is no longer valid",
    body: "The exam sitting on this device does not match the server. Ask a teacher before trying again.",
  },
  unknown: {
    title: "Something went wrong",
    body: "The exam could not continue. Ask a teacher for help.",
  },
};

function classifyError(code: string | undefined): RpcErrorCode {
  switch (code) {
    case "invalid_token":
    case "expired":
    case "already_submitted":
    case "session_already_active":
    case "not_in_progress":
    case "question_not_assigned":
    case "invalid_session_id":
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
    /invalid_token|expired|already_submitted|session_already_active|not_in_progress|question_not_assigned|invalid_session_id/,
  );
  return match?.[0];
}

function optionList(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.map((option) => String(option)).filter((option) => option.length > 0);
  }
  if (typeof options === "string") {
    try {
      return optionList(JSON.parse(options));
    } catch {
      return [];
    }
  }
  return [];
}

function sanitizeNumeric(value: string) {
  let next = value.replace(/[^0-9.-]/g, "");
  const minus = next.startsWith("-") ? "-" : "";
  next = next.replace(/-/g, "");
  const parts = next.split(".");
  if (parts.length > 1) {
    next = `${parts[0]}.${parts.slice(1).join("")}`;
  }
  return minus + next;
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

  const [loading, setLoading] = useState(true);
  const [blockingError, setBlockingError] = useState<RpcErrorCode | null>(null);
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [autosave, setAutosave] = useState<AutosaveState>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  const stopExam = useCallback((code: RpcErrorCode) => {
    examStoppedRef.current = true;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setBlockingError(code);
    setConfirmOpen(false);
  }, []);

  const remainingMs =
    expiresAtMs === null ? null : expiresAtMs - (nowMs + clockOffsetMs);

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
      setQuestions(payload.questions ?? []);
      setExpiresAtMs(new Date(payload.expires_at).getTime());
      setClockOffsetMs(offset);
      setNowMs(Date.now());
      setLoading(false);
    }

    void start();

    return () => {
      cancelled = true;
    };
  }, [stopExam, supabase, token]);

  useEffect(() => {
    if (loading || blockingError || submitted || expiresAtMs === null) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [blockingError, expiresAtMs, loading, submitted]);

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
    if (remainingMs === null || remainingMs > 0) return;
    if (loading || blockingError || submitted) return;
    void submitExam();
  }, [blockingError, loading, remainingMs, submitExam, submitted]);

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
          const code = classifyError(
            extractErrorCode(
              payload && payload.ok === false ? payload : null,
              error,
            ),
          );
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
        setAutosave("saved");
      }, 800);
    },
    [stopExam, submitted, supabase, token],
  );

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    saveAnswer(questionId, value);
  }

  const question = questions[index];
  const total = questions.length;

  if (loading) {
    return (
      <main className="mx-auto flex min-h-svh max-w-2xl items-center justify-center p-6">
        <p className="text-muted-foreground">Opening your exam…</p>
      </main>
    );
  }

  if (blockingError) {
    const copy = ERROR_COPY[blockingError];
    return (
      <main className="mx-auto flex min-h-svh max-w-2xl items-center justify-center p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.body}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-svh max-w-2xl items-center justify-center p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Exam submitted</CardTitle>
            <CardDescription>
              Your answers have been recorded. You can close this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!question || total === 0) {
    return (
      <main className="mx-auto flex min-h-svh max-w-2xl items-center justify-center p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>No questions assigned</CardTitle>
            <CardDescription>
              This exam has no questions for you. Ask a teacher for help.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const options = optionList(question.options);
  const value = answers[question.id] ?? "";
  const autosaveLabel =
    autosave === "saving"
      ? "Saving…"
      : autosave === "saved"
        ? "Saved"
        : autosave === "error"
          ? "Couldn’t save — try again"
          : "";

  return (
    <main className="mx-auto min-h-svh max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Question {index + 1} of {total}
        </p>
        <p className="font-mono text-lg tabular-nums">
          {remainingMs === null ? "--:--" : formatRemaining(remainingMs)}
        </p>
      </div>
      <p className="mb-4 min-h-5 text-sm text-muted-foreground">{autosaveLabel}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium leading-relaxed">
            {question.question_text}
          </CardTitle>
          {question.category ? (
            <CardDescription>Category {question.category}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {question.type === "radio" ? (
            <fieldset className="space-y-2">
              <legend className="sr-only">Choose an answer</legend>
              {options.map((option) => {
                const id = `${question.id}-${option}`;
                return (
                  <div key={option} className="flex items-center gap-3">
                    <input
                      id={id}
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={value === option}
                      onChange={() => updateAnswer(question.id, option)}
                      className="size-4"
                    />
                    <Label htmlFor={id} className="text-base font-normal">
                      {option}
                    </Label>
                  </div>
                );
              })}
            </fieldset>
          ) : null}

          {question.type === "numeric" ? (
            <div className="space-y-2">
              <Label htmlFor="numeric-answer">Numeric answer</Label>
              <Input
                id="numeric-answer"
                inputMode="decimal"
                autoComplete="off"
                value={value}
                onChange={(event) =>
                  updateAnswer(question.id, sanitizeNumeric(event.target.value))
                }
              />
            </div>
          ) : null}

          {question.type === "text" ? (
            <div className="space-y-2">
              <Label htmlFor="text-answer">Your answer</Label>
              <textarea
                id="text-answer"
                value={value}
                onChange={(event) => updateAnswer(question.id, event.target.value)}
                className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={index === 0}
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={index >= total - 1}
              onClick={() => setIndex((current) => Math.min(total - 1, current + 1))}
            >
              Next
            </Button>
          </div>
          <Button type="button" onClick={() => setConfirmOpen(true)}>
            Submit exam
          </Button>
        </CardFooter>
      </Card>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Submit this exam?</CardTitle>
              <CardDescription>
                You will not be able to change answers after submitting.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={submitBusy}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitBusy}
                onClick={() => void submitExam()}
              >
                {submitBusy ? "Submitting…" : "Submit"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
