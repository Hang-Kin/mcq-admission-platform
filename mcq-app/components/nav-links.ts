export type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
  /** Also highlight this item on a grades page for one exam. */
  matchGrades?: boolean;
};

export const staffNavLinks: NavLink[] = [
  { href: "/admin", label: "Home", exact: true },
  { href: "/admin/bank", label: "Questions" },
  { href: "/admin/schedule", label: "Sittings" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/review", label: "Results", matchGrades: true },
];

const GRADES_PATH = /^\/admin\/exams\/[^/]+\/grades(?:\/|$)/;

export function isNavActive(pathname: string, link: NavLink): boolean {
  if (link.matchGrades && GRADES_PATH.test(pathname)) return true;
  if (link.exact || link.href === "/") return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}
