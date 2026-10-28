const SUBJECTS = ["Math", "Chinese"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SubjectName = (typeof SUBJECTS)[number];

function isRealTopic(category: string | null | undefined): boolean {
  const value = category?.trim() ?? "";
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower !== "math" && lower !== "chinese";
}

function sittingState(prepared: boolean, locked: boolean): "Not prepared" | "Prepared" | "Locked" {
  if (locked) return "Locked";
  if (prepared) return "Prepared";
  return "Not prepared";
}

export type ChecklistStep = {
  title: string;
  status: string;
  detail: string;
  href: string;
  action: string;
  done: boolean;
  warn: boolean;
};

export type QuestionFact = {
  subject: string;
  category: string | null;
};

export function questionsChecklist(input: {
  missing: boolean;
  failed: boolean;
  questions: QuestionFact[];
  perTopic: Record<SubjectName, number>;
}): ChecklistStep {
  const base = {
    title: "Questions",
    href: "/admin/bank",
    action: "Open questions",
  };

  if (input.missing) {
    return {
      ...base,
      status: "Waiting",
      detail: "Waiting for a database update.",
      done: false,
      warn: false,
    };
  }
  if (input.failed) {
    return {
      ...base,
      status: "Needs attention",
      detail: "Could not check the questions.",
      done: false,
      warn: false,
    };
  }

  const emptySubjects: string[] = [];
  let shortTopics = 0;
  for (const subject of SUBJECTS) {
    const counts = new Map<string, number>();
    for (const question of input.questions) {
      if (question.subject !== subject || !isRealTopic(question.category)) continue;
      const name = question.category!.trim();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    if (counts.size === 0) emptySubjects.push(subject);
    const need = input.perTopic[subject];
    for (const count of counts.values()) {
      if (count < need) shortTopics += 1;
    }
  }

  if (emptySubjects.length === 0 && shortTopics === 0) {
    return {
      ...base,
      status: "Ready",
      detail: "Math and Chinese have enough questions in every topic.",
      done: true,
      warn: false,
    };
  }

  const parts: string[] = [];
  if (emptySubjects.length === SUBJECTS.length) {
    parts.push("Math and Chinese have no topics yet.");
  } else if (emptySubjects.length === 1) {
    parts.push(`${emptySubjects[0]} has no topics yet.`);
  }
  if (shortTopics === 1) parts.push("1 topic needs more questions.");
  else if (shortTopics > 1) parts.push(`${shortTopics} topics need more questions.`);

  return {
    ...base,
    status: "Needs questions",
    detail: parts.join(" "),
    done: false,
    warn: false,
  };
}

export type SittingFact = {
  label: string;
  startsAt: string | null;
  prepared: boolean;
  locked: boolean;
};

export function isStartInNext24Hours(startsAt: string | null, nowMs: number): boolean {
  if (!startsAt) return false;
  const startMs = Date.parse(startsAt);
  if (Number.isNaN(startMs)) return false;
  return startMs >= nowMs && startMs <= nowMs + DAY_MS;
}

export function sittingsChecklist(input: {
  missing: boolean;
  failed: boolean;
  sittings: SittingFact[];
  nowMs: number;
  when: (startsAt: string) => string;
}): ChecklistStep {
  const base = {
    title: "Sittings",
    href: "/admin/schedule",
    action: "Open sittings",
  };

  if (input.missing) {
    return {
      ...base,
      status: "Waiting",
      detail: "Waiting for a database update.",
      done: false,
      warn: false,
    };
  }
  if (input.failed) {
    return {
      ...base,
      status: "Needs attention",
      detail: "Could not check the sittings.",
      done: false,
      warn: false,
    };
  }
  if (input.sittings.length === 0) {
    return {
      ...base,
      status: "No sittings",
      detail: "No sittings yet.",
      done: false,
      warn: false,
    };
  }

  const warnings = input.sittings.filter((sitting) => {
    const status = sittingState(sitting.prepared, sitting.locked);
    return status === "Not prepared" && isStartInNext24Hours(sitting.startsAt, input.nowMs);
  });

  if (warnings.length === 0) {
    return {
      ...base,
      status: "Ready",
      detail: "Sittings in the next day are prepared.",
      done: true,
      warn: false,
    };
  }

  const detail = warnings
    .map((sitting) => {
      const name = sitting.label.trim() || "Sitting";
      const when = sitting.startsAt ? input.when(sitting.startsAt) : "soon";
      return `${name} starts ${when} and the questions are not prepared.`;
    })
    .join(" ");

  return {
    ...base,
    status: "Needs attention",
    detail,
    done: false,
    warn: true,
  };
}

export type ExamFact = {
  id: string;
  createdAt: string | null;
};

export type SlotFact = {
  examId: string | null;
  endsAt: string | null;
};

export function nextExamId(slots: SlotFact[], exams: ExamFact[], nowMs: number): string | null {
  const future = slots
    .filter((slot) => slot.examId && slot.endsAt && Date.parse(slot.endsAt) > nowMs)
    .sort((a, b) => Date.parse(a.endsAt ?? "") - Date.parse(b.endsAt ?? ""));
  if (future[0]?.examId) return future[0].examId;

  const newest = [...exams].sort((a, b) => {
    const aMs = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bMs = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bMs - aMs;
  });
  return newest[0]?.id ?? null;
}

export function qrChecklist(input: {
  failed: boolean;
  hasExam: boolean;
  studentCount: number;
  codedStudentCount: number;
}): ChecklistStep {
  const open = {
    title: "QR codes",
    href: "/admin/schedule#codes",
    action: "Open QR codes",
  };

  if (input.failed) {
    return {
      ...open,
      status: "Needs attention",
      detail: "Could not check the QR codes.",
      done: false,
      warn: false,
    };
  }
  if (input.studentCount === 0) {
    return {
      title: "QR codes",
      href: "/admin/students",
      action: "Add students",
      status: "Add students first",
      detail: "Add students first.",
      done: false,
      warn: false,
    };
  }
  if (!input.hasExam || input.codedStudentCount === 0) {
    return {
      ...open,
      status: "Not created",
      detail: "No codes yet for the next sitting.",
      done: false,
      warn: false,
    };
  }
  if (input.codedStudentCount < input.studentCount) {
    return {
      ...open,
      status: "Not created",
      detail: `Codes created for ${input.codedStudentCount} of ${input.studentCount} students.`,
      done: false,
      warn: false,
    };
  }

  const students = input.studentCount === 1 ? "1 student" : `${input.studentCount} students`;
  return {
    ...open,
    status: "Created",
    detail: `Codes created for ${students}.`,
    done: true,
    warn: false,
  };
}

export function resultsChecklist(input: {
  failed: boolean;
  waiting: number;
}): ChecklistStep {
  const base = {
    title: "Results",
    href: "/admin/review",
    action: "Open results",
  };
  if (input.failed) {
    return {
      ...base,
      status: "Needs attention",
      detail: "Could not check written answers.",
      done: false,
      warn: false,
    };
  }
  if (input.waiting <= 0) {
    return {
      ...base,
      status: "Nothing waiting",
      detail: "No written answers to mark.",
      done: true,
      warn: false,
    };
  }
  const answers = input.waiting === 1 ? "1 written answer waiting." : `${input.waiting} written answers waiting.`;
  return {
    ...base,
    status: input.waiting === 1 ? "1 waiting" : `${input.waiting} waiting`,
    detail: answers,
    done: false,
    warn: false,
  };
}

export function markPrimary(steps: ChecklistStep[]): Array<ChecklistStep & { primary: boolean }> {
  const index = steps.findIndex((step) => !step.done);
  return steps.map((step, stepIndex) => ({ ...step, primary: stepIndex === index }));
}
