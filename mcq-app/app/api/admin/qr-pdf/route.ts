import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { createPendingQrCodes, loadPendingQrCodes } from "@/app/admin/exams/qrCodes";
import { buildQrSheetPdf, type QrCard } from "@/app/admin/exams/qrPdf";
import { formatIntakeLabel, INTAKE_RE } from "@/app/admin/students/intakeLabel";
import { isMissingSchema } from "@/app/admin/students/schemaError";
import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const MAX_STUDENTS = 500;

type PdfMode = "create" | "download";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.length > 0 && !ids.includes(item)) ids.push(item);
  }
  return ids;
}

function sheetOrigin(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  if (fromEnv.length > 0) return fromEnv;
  return request.nextUrl.origin;
}

function pdfFilename(intakes: string[]): string {
  const unique = [...new Set(intakes)];
  if (unique.length === 1 && unique[0] && INTAKE_RE.test(unique[0])) {
    return `qr-codes-${unique[0]}.pdf`;
  }
  return "qr-codes.pdf";
}

export async function POST(request: NextRequest) {
  let body: {
    examId?: unknown;
    studentIds?: unknown;
    mode?: unknown;
    questionSetNames?: unknown;
    questionCount?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const examId = typeof body.examId === "string" ? body.examId : "";
  const mode: PdfMode | null = body.mode === "create" || body.mode === "download" ? body.mode : null;
  const studentIds = stringList(body.studentIds);
  if (!examId) return jsonError("missing_exam_id", 400);
  if (!mode) return jsonError("invalid_json", 400);
  if (studentIds.length === 0) return jsonError("no_students_selected", 400);
  if (studentIds.length > MAX_STUDENTS) return jsonError("too_many_students", 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("not_authenticated", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!isStaffRole(profile?.role)) return jsonError("not_staff", 403);

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, duration_minutes")
    .eq("id", examId)
    .single();
  if (examError || !exam) return jsonError("exam_not_found", 404);

  let batch;
  if (mode === "download") {
    const loaded = await loadPendingQrCodes(supabase, examId, studentIds);
    if ("error" in loaded) return jsonError("could_not_create_codes", 500);
    batch = loaded;
  } else {
    const { count: sectionCount, error: sectionError } = await supabase
      .from("exam_sections")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId);
    if (sectionError) return jsonError("question_fetch_failed", 500);

    const usesSections = (sectionCount ?? 0) > 0;
    let assignedQuestionIds: string[] = [];
    if (!usesSections) {
      const questionSetNames = stringList(body.questionSetNames);
      const questionCount = body.questionCount;
      if (questionSetNames.length === 0) return jsonError("no_question_sets_selected", 400);
      if (typeof questionCount !== "number" || !Number.isInteger(questionCount) || questionCount <= 0) {
        return jsonError("invalid_question_count", 400);
      }
      const { data: candidateQuestions, error: questionsError } = await supabase
        .from("questions")
        .select("id")
        .in("question_set", questionSetNames);
      if (questionsError) return jsonError("question_fetch_failed", 500);
      if (!candidateQuestions || candidateQuestions.length < questionCount) {
        return jsonError("not_enough_questions_in_selected_sets", 400);
      }
      const shuffled = [...candidateQuestions].sort(() => Math.random() - 0.5);
      assignedQuestionIds = shuffled.slice(0, questionCount).map((question) => String(question.id));
    }

    const expiresAt = new Date(Date.now() + exam.duration_minutes * 60 * 1000).toISOString();
    batch = await createPendingQrCodes(supabase, {
      examId,
      studentIds,
      assignedQuestionIds,
      expiresAt,
    });
  }

  if (batch.created.length === 0) {
    if (batch.skippedFailed > 0) return jsonError("could_not_create_codes", 500);
    return jsonError("nothing_to_print", 400);
  }

  const { data: studentRows, error: studentError } = await supabase
    .from("students")
    .select("id, name, application_number, intake")
    .in(
      "id",
      batch.created.map((row) => row.studentId),
    );
  if (studentError) {
    if (isMissingSchema(studentError)) return jsonError("intake_not_ready", 400);
    return jsonError("could_not_create_codes", 500);
  }

  const studentsById = new Map(
    (studentRows ?? []).map((student) => [
      String(student.id),
      {
        name: typeof student.name === "string" ? student.name : "",
        applicationNumber:
          typeof student.application_number === "string" ? student.application_number : "",
        intake: typeof student.intake === "string" ? student.intake : "",
      },
    ]),
  );

  const origin = sheetOrigin(request);
  const cards: QrCard[] = [];
  const intakes: string[] = [];
  for (const row of batch.created) {
    const student = studentsById.get(row.studentId);
    if (!student || student.applicationNumber.length === 0) continue;
    const intakeLabel = formatIntakeLabel(student.intake) ?? student.intake;
    if (student.intake) intakes.push(student.intake);
    cards.push({
      name: student.name,
      applicationNumber: student.applicationNumber,
      intakeLabel,
      url: `${origin}/session/${row.token}`,
    });
  }
  cards.sort((a, b) => a.applicationNumber.localeCompare(b.applicationNumber) || a.name.localeCompare(b.name));
  if (cards.length === 0) return jsonError("could_not_create_codes", 500);

  let pdf: Uint8Array;
  try {
    const fontBytes = new Uint8Array(
      await readFile(path.join(process.cwd(), "assets/fonts/NotoSansSC-subset.ttf")),
    );
    pdf = await buildQrSheetPdf({ fontBytes, cards });
  } catch {
    console.error("qr-pdf: failed to build the sheet");
    return jsonError("could_not_create_codes", 500);
  }

  const downloadName = pdfFilename(intakes);

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Qr-Count": String(cards.length),
      "X-Qr-Skipped-Started": String(batch.skippedStarted),
      "X-Qr-Skipped-Missing": String(batch.skippedMissing),
      "X-Qr-Skipped-Failed": String(batch.skippedFailed),
    },
  });
}
