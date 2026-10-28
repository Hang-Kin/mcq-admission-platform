export type SittingStatus = "Not prepared" | "Prepared" | "Locked";

export type DrawRow = {
  subject: string;
  category: string;
  position: number;
  questionText: string;
};

export type TopicOrder = {
  subject: string;
  category: string;
  displayOrder: number;
};

export type PreviewGroup = {
  subject: string;
  topics: Array<{ name: string; questions: string[] }>;
};

const SUBJECT_ORDER = ["Math", "Chinese"];

export function sittingStatus(prepared: boolean, locked: boolean): SittingStatus {
  if (locked) return "Locked";
  if (prepared) return "Prepared";
  return "Not prepared";
}

export function sittingButton(status: SittingStatus): {
  label: string;
  disabled: boolean;
  force: boolean;
} {
  if (status === "Locked") {
    return { label: "Locked (students started)", disabled: true, force: false };
  }
  if (status === "Prepared") {
    return { label: "Redraw", disabled: false, force: true };
  }
  return { label: "Prepare questions", disabled: false, force: false };
}

export function groupDrawPreview(rows: DrawRow[], orders: TopicOrder[]): PreviewGroup[] {
  const rank = new Map<string, number>();
  for (const order of orders) {
    if (!Number.isInteger(order.displayOrder) || order.displayOrder < 1) continue;
    rank.set(`${order.subject}\0${order.category}`, order.displayOrder);
  }

  const bySubject = new Map<string, Map<string, Array<{ position: number; text: string }>>>();
  for (const row of rows) {
    const topics = bySubject.get(row.subject) ?? new Map();
    const questions = topics.get(row.category) ?? [];
    questions.push({ position: row.position, text: row.questionText });
    topics.set(row.category, questions);
    bySubject.set(row.subject, topics);
  }

  const subjects = [...bySubject.keys()].sort((a, b) => subjectSort(a, b));

  return subjects.map((subject) => {
    const topics = [...(bySubject.get(subject)?.entries() ?? [])];
    topics.sort((a, b) => {
      const aRank = rank.get(`${subject}\0${a[0]}`);
      const bRank = rank.get(`${subject}\0${b[0]}`);
      const aPlaced = aRank != null;
      const bPlaced = bRank != null;
      if (aPlaced && bPlaced && aRank !== bRank) return aRank - bRank;
      if (aPlaced !== bPlaced) return aPlaced ? -1 : 1;
      return a[0].localeCompare(b[0], "zh");
    });

    return {
      subject,
      topics: topics.map(([name, questions]) => ({
        name,
        questions: [...questions]
          .sort((a, b) => a.position - b.position || a.text.localeCompare(b.text))
          .map((question) => question.text),
      })),
    };
  });
}

function subjectSort(a: string, b: string) {
  const aIndex = SUBJECT_ORDER.indexOf(a);
  const bIndex = SUBJECT_ORDER.indexOf(b);
  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;
  return a.localeCompare(b, "zh");
}

export function drawErrorMessage(error: string): string {
  const text = error.trim();
  if (text === "not_staff") return "You do not have permission to prepare questions.";
  if (text === "timeslot_not_found") return "This sitting could not be found.";
  if (/student has already started/i.test(text)) {
    return "A student has already started. These questions are locked.";
  }
  if (/no subject/i.test(text)) {
    return "This exam is not marked as Math or Chinese, so there is nothing to prepare.";
  }
  if (/missing subject settings/i.test(text)) {
    return "Choose questions per topic for each subject, then prepare again.";
  }
  return text.replaceAll(": no topics to draw", " has no topics yet").replaceAll("; ", ". ");
}

export function isMissingSchema(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the function")
  );
}

const SITTING_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSittingId(value: string): string | null {
  const id = value.trim();
  return SITTING_ID.test(id) ? id : null;
}
