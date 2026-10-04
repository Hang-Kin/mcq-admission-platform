import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const cards = [
  {
    href: "/admin/exams",
    title: "Exams",
    description:
      "Open an exam to print QR codes, set timeslots and sections, and review grades.",
  },
  {
    href: "/admin/exams/new",
    title: "Create exam",
    description: "Name the exam and set how many minutes students have.",
  },
  {
    href: "/admin/questions/import",
    title: "Question import",
    description: "Upload a CSV of radio, numeric, and text questions.",
  },
  {
    href: "/admin/questions",
    title: "Questions",
    description: "Browse the bank, filter by set, and edit a question.",
  },
  {
    href: "/admin/questions/new",
    title: "New question",
    description: "Add one question, with an optional image and question set.",
  },
  {
    href: "/admin/review",
    title: "Grading review",
    description: "Mark text answers that are still waiting for a teacher.",
  },
  {
    href: "/admin/students",
    title: "Students",
    description: "Add students one at a time and check the roster.",
  },
  {
    href: "/admin",
    title: "Admin dashboard",
    description: "Staff home for exams, questions, students, and the review queue.",
  },
  {
    href: "/admin/exams",
    title: "Student entry",
    description:
      "Students open the /session link from their QR code. Print those codes from an exam.",
  },
  {
    href: "/auth/login",
    title: "Sign in",
    description: "Staff sign in. Account creation and password reset start here.",
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl">MCQ Admission</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Set up an exam, import questions, and send each student in through a
          personal link.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="block h-full rounded-lg text-foreground hover:no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Card className="h-full hover:border-primary">
              <CardHeader>
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription className="leading-6">
                  {card.description}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
