/**
 * Admin pages staff no longer need. The files stay in the repo.
 *
 * A route with * matches exactly one path segment and nothing after it,
 * so /admin/exams/ID/grades does not block /admin/exams/ID/grades/INSTANCE
 * (that page still redirects to Review).
 *
 * /admin/exams matches only itself, so timeslots and sections stay open.
 * /admin/questions is not hidden. If it is added here later, it also matches
 * only itself, so the regrade editor and the older import stay open.
 */
export const HIDDEN_ADMIN_ROUTES: string[] = [
  "/admin/advanced",
  "/admin/exams",
  "/admin/exams/new",
  "/admin/exams/*/qr",
  "/admin/exams/*/grades",
];

const EXACT_ONLY = new Set(["/admin/exams", "/admin/questions"]);

function matchesRoute(route: string, path: string): boolean {
  if (route.includes("*")) {
    const pattern = route
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^/]+");
    return new RegExp(`^${pattern}$`).test(path);
  }
  if (EXACT_ONLY.has(route)) return path === route;
  return path === route || path.startsWith(`${route}/`);
}

export function isHiddenAdminRoute(pathname: string): boolean {
  const clean = (pathname.split("#")[0] ?? "").split("?")[0] ?? "";
  const path = clean.length > 1 && clean.endsWith("/") ? clean.slice(0, -1) : clean;
  return HIDDEN_ADMIN_ROUTES.some((route) => matchesRoute(route, path));
}
