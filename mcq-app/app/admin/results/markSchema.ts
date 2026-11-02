import { isMissingSchema } from "@/app/admin/students/schemaError";

export function isMissingMarking(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (isMissingSchema(error)) return true;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST200" ||
    code === "PGRST202" ||
    message.includes("response_marks") ||
    message.includes("regrade_log") ||
    message.includes("teacher_confirm") ||
    message.includes("teacher_override") ||
    message.includes("apply_question_regrade") ||
    message.includes("could not find the function")
  );
}
