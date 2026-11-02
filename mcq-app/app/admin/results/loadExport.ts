import { isMissingSubjectColumn } from "@/components/mathText";
import { INTAKE_WAITING_READ, isMissingSchema } from "@/app/admin/students/schemaError";
import type { createClient } from "@/lib/supabase/server";

import {
  buildResultRow,
  filterByIntake,
  idList,
  sortResultRows,
  type ExportQuestion,
  type ExportResponse,
  type ResultRow,
} from "./columns";

type Client = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message?: string; code?: string } | null;

const PAGE_SIZE = 1000;
const CHUNK = 80;

function chunks(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    out.push(ids.slice(index, index + size));
  }
  return out;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function boolOrNull(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

function records(value: unknown): Array<Record<string, unknown>> {
  const list: unknown[] = Array.isArray(value) ? value : [];
  const rows: Array<Record<string, unknown>> = [];
  for (const row of list) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      rows.push(row as Record<string, unknown>);
    }
  }
  return rows;
}

async function everyPage<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: QueryError }>,
): Promise<{ rows: T[]; error: QueryError }> {
  const rows: T[] = [];
  for (let from = 0; from < 20000; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) return { rows: [], error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, error: null };
  }
  return { rows: [], error: { message: "Too many rows to export." } };
}

async function byIds<T>(
  ids: string[],
  load: (
    chunk: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: QueryError }>,
): Promise<{ rows: T[]; error: QueryError }> {
  const rows: T[] = [];
  for (const chunk of chunks(unique(ids), CHUNK)) {
    const page = await everyPage((from, to) => load(chunk, from, to));
    if (page.error) return { rows: [], error: page.error };
    rows.push(...page.rows);
  }
  return { rows, error: null };
}

export async function loadExportRows(
  supabase: Client,
  examId: string,
  intake: string,
): Promise<{ ok: true; rows: ResultRow[] } | { ok: false; status: number; error: string }> {
  const exam = await supabase.from("exams").select("id").eq("id", examId).maybeSingle();
  if (exam.error) return { ok: false, status: 500, error: "Could not load the exam." };
  if (!exam.data) return { ok: false, status: 404, error: "That exam was not found." };

  if (intake) {
    const probe = await supabase.from("students").select("intake").limit(1);
    if (probe.error && isMissingSchema(probe.error)) {
      return { ok: false, status: 400, error: INTAKE_WAITING_READ };
    }
    if (probe.error) return { ok: false, status: 500, error: "Could not load intakes." };
  }

  const instances = await everyPage((from, to) =>
    supabase
      .from("test_instances")
      .select("id, student_id, timeslot_id, started_at, submitted_at, assigned_question_ids")
      .eq("exam_id", examId)
      .eq("status", "submitted")
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (instances.error) return { ok: false, status: 500, error: "Could not load results." };

  const instanceRows = records(instances.rows);
  const studentIds = unique(instanceRows.map((row) => text(row.student_id)).filter(Boolean));
  const slotIds = unique(instanceRows.map((row) => text(row.timeslot_id)).filter(Boolean));

  let studentSelect = "id, name, application_number, chinese_name, intake";
  let students = await byIds(studentIds, (chunk, from, to) =>
    supabase.from("students").select(studentSelect).in("id", chunk).range(from, to),
  );
  if (students.error && isMissingSchema(students.error)) {
    if (intake) return { ok: false, status: 400, error: INTAKE_WAITING_READ };
    studentSelect = "id, name, application_number";
    students = await byIds(studentIds, (chunk, from, to) =>
      supabase.from("students").select(studentSelect).in("id", chunk).range(from, to),
    );
  }
  if (students.error) return { ok: false, status: 500, error: "Could not load students." };

  const slots = await byIds(slotIds, (chunk, from, to) =>
    supabase.from("timeslots").select("id, label").in("id", chunk).range(from, to),
  );
  if (slots.error) return { ok: false, status: 500, error: "Could not load slots." };

  const instanceIds = instanceRows.map((row) => text(row.id)).filter(Boolean);
  const responses = await byIds(instanceIds, (chunk, from, to) =>
    supabase
      .from("responses")
      .select("test_instance_id, question_id, is_correct")
      .in("test_instance_id", chunk)
      .range(from, to),
  );
  if (responses.error) return { ok: false, status: 500, error: "Could not load scores." };

  const assignedByInstance = new Map<string, string[]>();
  const questionIds: string[] = [];
  for (const row of instanceRows) {
    const ids = idList(row.assigned_question_ids);
    assignedByInstance.set(text(row.id), ids);
    questionIds.push(...ids);
  }

  let questionSelect = "id, category, subject";
  let questions = await byIds(questionIds, (chunk, from, to) =>
    supabase.from("questions").select(questionSelect).in("id", chunk).range(from, to),
  );
  if (questions.error && isMissingSubjectColumn(questions.error.message)) {
    questionSelect = "id, category";
    questions = await byIds(questionIds, (chunk, from, to) =>
      supabase.from("questions").select(questionSelect).in("id", chunk).range(from, to),
    );
  }
  if (questions.error) return { ok: false, status: 500, error: "Could not load scores." };

  const studentById = new Map(records(students.rows).map((row) => [text(row.id), row]));
  const slotById = new Map(records(slots.rows).map((row) => [text(row.id), text(row.label)]));
  const questionById = new Map<string, ExportQuestion>();
  for (const row of records(questions.rows)) {
    const id = text(row.id);
    if (!id) continue;
    questionById.set(id, {
      id,
      category: text(row.category),
      subject: "subject" in row ? textOrNull(row.subject) : null,
    });
  }
  const responsesByInstance = new Map<string, ExportResponse[]>();
  for (const row of records(responses.rows)) {
    const instanceId = text(row.test_instance_id);
    const questionId = text(row.question_id);
    if (!instanceId || !questionId) continue;
    const list = responsesByInstance.get(instanceId) ?? [];
    list.push({ questionId, isCorrect: boolOrNull(row.is_correct) });
    responsesByInstance.set(instanceId, list);
  }

  const built = instanceRows.map((row) => {
    const id = text(row.id);
    const student = studentById.get(text(row.student_id));
    const assignedIds = assignedByInstance.get(id) ?? [];
    return buildResultRow({
      submissionCode: text(student?.application_number),
      englishName: text(student?.name),
      chineseName: text(student?.chinese_name),
      intake: text(student?.intake),
      slot: slotById.get(text(row.timeslot_id)) ?? "",
      startedAt: textOrNull(row.started_at),
      submittedAt: textOrNull(row.submitted_at),
      assigned: assignedIds.map(
        (questionId) => questionById.get(questionId) ?? { id: questionId, category: "", subject: null },
      ),
      responses: responsesByInstance.get(id) ?? [],
    });
  });

  return { ok: true, rows: sortResultRows(filterByIntake(built, intake)) };
}
