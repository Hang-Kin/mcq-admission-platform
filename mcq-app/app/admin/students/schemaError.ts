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

export const INTAKE_WAITING_READ =
  "Student intakes are waiting for a database update.";

export const INTAKE_WAITING_WRITE =
  "Student intakes are waiting for a database update. Nothing was saved.";
