import { NextResponse, type NextRequest } from "next/server";

import { INTAKE_RE } from "@/app/admin/students/intakeLabel";

import { resultsCsv } from "../columns";
import { UUID_RE } from "../ids";
import { loadExportRows } from "../loadExport";
import { requireStaff } from "../staffGate";
import { resultsWorkbook } from "../workbook";

export const instant = false;

export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff.ok) return new NextResponse(staff.error, { status: staff.status });

  const params = request.nextUrl.searchParams;
  const examId = params.get("examId")?.trim() ?? "";
  const intake = params.get("intake")?.trim() ?? "";
  const format = params.get("format");

  if (!UUID_RE.test(examId)) return new NextResponse("Choose an exam.", { status: 400 });
  if (intake && !INTAKE_RE.test(intake)) {
    return new NextResponse("That intake is not valid.", { status: 400 });
  }
  if (format !== "xlsx" && format !== "csv") {
    return new NextResponse("Choose Excel or CSV.", { status: 400 });
  }

  const loaded = await loadExportRows(staff.supabase, examId, intake);
  if (!loaded.ok) return new NextResponse(loaded.error, { status: loaded.status });

  const filename = intake ? `results-${intake}` : "results";
  if (format === "csv") {
    return new NextResponse(resultsCsv(loaded.rows), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  const bytes = await resultsWorkbook(loaded.rows);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
