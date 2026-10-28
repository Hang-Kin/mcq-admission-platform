export function isMissingSchema(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

export function bankWriteError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("fraction") ||
    lower.includes("questions_type") ||
    lower.includes("check constraint")
  ) {
    return "That answer could not be saved. A fraction must be simplified, like 1/3.";
  }
  if (
    lower.includes("subject") ||
    lower.includes("schema cache") ||
    lower.includes("does not exist")
  ) {
    return "The question bank is waiting for a database update. Nothing was saved.";
  }
  if (lower.includes("row-level") || lower.includes("permission") || lower.includes("policy")) {
    return "You do not have permission to change this question.";
  }
  return "Could not save this question.";
}
