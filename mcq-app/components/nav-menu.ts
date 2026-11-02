export type NavMenuLink = {
  href: string;
  label: string;
  labelKey: string;
};

export type NavMenuGroup = {
  id: string;
  label: string;
  labelKey: string;
  /** Set when the group heading itself is the page. */
  href?: string;
  items: NavMenuLink[];
};

export type NavSection = {
  id: string;
  href: string;
  label: string;
  labelKey: string;
  exact?: boolean;
  matchGrades?: boolean;
  extraHrefs?: readonly string[];
  groups: NavMenuGroup[];
};

/**
 * One list for the navbar. Add a page by appending a group or item.
 *
 * Not linked, because there is no stable page without an id, or the
 * destination is only a heading on a page this lane cannot edit:
 * - Per-exam times, sections, QR, and grades (/admin/exams/[examId]/...)
 * - Results sections Export, Grades, and Written answers waiting (no anchors)
 * - Review of one sitting (/admin/review/[instanceId])
 * Subject settings uses /admin/settings. The same form also sits on
 * /admin/bank?tab=settings.
 */
export const staffNavMenu: NavSection[] = [
  {
    id: "home",
    href: "/admin",
    label: "Home",
    labelKey: "shell.nav.home",
    exact: true,
    groups: [
      {
        id: "checklist",
        label: "Checklist",
        labelKey: "shell.group.checklist",
        items: [
          { href: "/admin/bank", label: "Questions", labelKey: "shell.item.checklistQuestions" },
          { href: "/admin/schedule", label: "Sittings", labelKey: "shell.item.checklistSittings" },
          {
            href: "/admin/schedule#codes",
            label: "QR codes",
            labelKey: "shell.item.checklistCodes",
          },
          { href: "/admin/review", label: "Results", labelKey: "shell.item.checklistResults" },
        ],
      },
    ],
  },
  {
    id: "questions",
    href: "/admin/bank",
    label: "Questions",
    labelKey: "shell.nav.questions",
    extraHrefs: ["/admin/settings"],
    groups: [
      {
        id: "questionBanks",
        label: "Questions",
        labelKey: "shell.group.questionBanks",
        items: [
          {
            href: "/admin/bank/Math",
            label: "Math question bank",
            labelKey: "shell.item.mathBank",
          },
          {
            href: "/admin/bank/Chinese",
            label: "Chinese question bank",
            labelKey: "shell.item.chineseBank",
          },
        ],
      },
      {
        id: "subjectSettings",
        label: "Subject settings",
        labelKey: "shell.group.subjectSettings",
        href: "/admin/settings",
        items: [],
      },
    ],
  },
  {
    id: "sittings",
    href: "/admin/schedule",
    label: "Sittings",
    labelKey: "shell.nav.sittings",
    groups: [
      {
        id: "sittings",
        label: "Sittings",
        labelKey: "shell.group.sittings",
        items: [
          {
            href: "/admin/schedule",
            label: "Times and questions",
            labelKey: "shell.item.sittingTimes",
          },
          {
            href: "/admin/schedule#codes",
            label: "QR codes",
            labelKey: "shell.item.sittingCodes",
          },
        ],
      },
      {
        id: "exams",
        label: "Exams",
        labelKey: "shell.group.exams",
        items: [
          { href: "/admin/exams", label: "Exam list", labelKey: "shell.item.examList" },
          { href: "/admin/exams/new", label: "Create exam", labelKey: "shell.item.createExam" },
        ],
      },
    ],
  },
  {
    id: "students",
    href: "/admin/students",
    label: "Students",
    labelKey: "shell.nav.students",
    groups: [
      {
        id: "students",
        label: "Students",
        labelKey: "shell.group.students",
        items: [
          { href: "/admin/students", label: "Student list", labelKey: "shell.item.studentList" },
          {
            href: "/admin/students/import",
            label: "Import students",
            labelKey: "shell.item.importStudents",
          },
        ],
      },
    ],
  },
  {
    id: "results",
    href: "/admin/review",
    label: "Results",
    labelKey: "shell.nav.results",
    matchGrades: true,
    groups: [
      {
        id: "results",
        label: "Results",
        labelKey: "shell.group.results",
        items: [
          {
            href: "/admin/review",
            label: "Scores and written answers",
            labelKey: "shell.item.resultsHome",
          },
        ],
      },
    ],
  },
];

export type MenuOutlineGroup = {
  label: string;
  href: string | null;
  items: string[];
};

export type MenuOutline = {
  label: string;
  groups: MenuOutlineGroup[];
};

/** The groups and items a menu would show. */
export function renderMenuOutline(menu: readonly NavSection[] = staffNavMenu): MenuOutline[] {
  return menu.map((section) => ({
    label: section.label,
    groups: section.groups.map((group) => ({
      label: group.label,
      href: group.href ?? null,
      items: group.items.map((item) => item.label),
    })),
  }));
}
