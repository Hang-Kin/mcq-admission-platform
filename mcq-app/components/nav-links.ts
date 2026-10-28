export type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
  /** Also highlight this item on a grades page for one exam. */
  matchGrades?: boolean;
};

const GRADES_PATH = /^\/admin\/exams\/[^/]+\/grades(?:\/|$)/;

export function isNavActive(pathname: string, link: NavLink): boolean {
  if (link.matchGrades && GRADES_PATH.test(pathname)) return true;
  if (link.exact || link.href === "/") return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}
