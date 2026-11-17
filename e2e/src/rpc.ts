import { assertStagingHost, stagingAnonKey } from "./guard";

type RpcBody = Record<string, unknown>;

export type CallResult = {
  status: number;
  body: unknown;
};

function restBase() {
  return `${assertStagingHost().replace(/\/$/, "")}/rest/v1`;
}

function authBase() {
  return `${assertStagingHost().replace(/\/$/, "")}/auth/v1`;
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ accessToken: string | null; userId: string | null; error: string | null }> {
  const response = await fetch(`${authBase()}/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: stagingAnonKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    user?: { id?: string };
    error_description?: string;
    msg?: string;
    error?: string;
  } | null;
  if (!response.ok || !body?.access_token) {
    return {
      accessToken: null,
      userId: null,
      error: body?.error_description || body?.msg || body?.error || `HTTP ${response.status}`,
    };
  }
  return { accessToken: body.access_token, userId: body.user?.id ?? null, error: null };
}

async function call(
  path: string,
  init: RequestInit,
  token: string | null,
): Promise<CallResult> {
  const headers = new Headers(init.headers);
  headers.set("apikey", stagingAnonKey());
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${restBase()}${path}`, { ...init, headers });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 300);
  }
  return { status: response.status, body };
}

export function readTable(table: string, token: string | null) {
  return call(`/${table}?select=*&limit=1`, { method: "GET" }, token);
}

export function callRpc(name: string, args: RpcBody, token: string | null) {
  return call(`/rpc/${name}`, { method: "POST", body: JSON.stringify(args) }, token);
}

export function summarize(result: CallResult): string {
  const body = result.body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const error = record.error ?? record.message ?? record.code ?? record.hint;
    const rows = Array.isArray(body) ? body.length : null;
    if (rows !== null) return `HTTP ${result.status} rows=${rows}`;
    return `HTTP ${result.status} ${typeof error === "string" ? error : JSON.stringify(record).slice(0, 240)}`;
  }
  return `HTTP ${result.status} ${String(body).slice(0, 240)}`;
}

const NIL = "00000000-0000-0000-0000-000000000000";

export const STAFF_RPCS: Array<{ name: string; args: RpcBody }> = [
  { name: "teacher_confirm_response", args: { p_response_id: NIL } },
  { name: "teacher_confirm_all", args: { p_instance_id: NIL } },
  {
    name: "teacher_override_response",
    args: { p_response_id: NIL, p_is_correct: false, p_note: "e2e" },
  },
  {
    name: "apply_question_regrade",
    args: { p_question_id: NIL, p_old_answer: "", p_new_answer: "", p_updates: [] },
  },
  { name: "delete_sitting_test_data", args: { p_timeslot_id: NIL, p_confirm: "DELETE" } },
];

export const SESSION_RPCS: Array<{ name: string; args: RpcBody }> = [
  { name: "start_session", args: { p_token: "not-a-real-token", p_session_id: null } },
  {
    name: "submit_answer",
    args: {
      p_token: "not-a-real-token",
      p_session_id: NIL,
      p_question_id: NIL,
      p_answer: "1",
    },
  },
  { name: "submit_exam", args: { p_token: "not-a-real-token", p_session_id: NIL } },
  {
    name: "advance_section",
    args: { p_token: "not-a-real-token", p_session_id: NIL, p_from_index: 0 },
  },
];

export const TABLES = [
  "test_instances",
  "questions",
  "students",
  "responses",
  "response_marks",
  "regrade_log",
];
