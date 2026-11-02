import { staffNavMenu, type NavSection } from "./nav-menu";

export type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
  /** Also highlight this item on a grades page for one exam. */
  matchGrades?: boolean;
  /** Other real pages that belong under this item, such as Subject settings. */
  extraHrefs?: readonly string[];
};

export const staffNavLinks: NavLink[] = staffNavMenu.map((section) => ({
  href: section.href,
  label: section.label,
  exact: section.exact,
  matchGrades: section.matchGrades,
  extraHrefs: section.extraHrefs,
}));

const GRADES_PATH = /^\/admin\/exams\/[^/]+\/grades(?:\/|$)/;

export function hrefPath(href: string): { path: string; hash: string } {
  const hashIndex = href.indexOf("#");
  const beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const path = beforeHash.split("?")[0] ?? beforeHash;
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  return { path, hash };
}

export function isHrefActive(pathname: string, href: string, hash = ""): boolean {
  const target = hrefPath(href);
  if (target.hash) return pathname === target.path && hash === target.hash;
  if (target.path === "/admin") return pathname === "/admin";
  if (pathname === target.path) return hash === "";
  return pathname.startsWith(`${target.path}/`);
}

export function isNavActive(pathname: string, link: NavLink): boolean {
  if (link.matchGrades && GRADES_PATH.test(pathname)) return true;
  if (link.extraHrefs?.some((href) => isHrefActive(pathname, href))) return true;
  if (link.exact || link.href === "/") return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function sectionLink(section: NavSection): NavLink {
  return {
    href: section.href,
    label: section.label,
    exact: section.exact,
    matchGrades: section.matchGrades,
    extraHrefs: section.extraHrefs,
  };
}
