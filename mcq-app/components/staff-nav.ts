/** Staff chrome stays off the student exam. `/session` and `/session/*` only. */
export function staffNavVisible(pathname: string): boolean {
  const withoutHash = pathname.split("#")[0] ?? "";
  const path = withoutHash.split("?")[0] ?? "";
  const normalized = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return normalized !== "/session" && !normalized.startsWith("/session/");
}
