import Link from "next/link";
import { connection } from "next/server";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const instant = false;

const links = [
  {
    href: "/admin/students",
    title: "Students",
    description: "Add names and application numbers to the roster.",
  },
  {
    href: "/admin/questions",
    title: "Questions",
    description: "Review the bank and open a question to edit it.",
  },
  {
    href: "/admin/questions/import",
    title: "Question import",
    description: "Upload questions from a CSV file.",
  },
  {
    href: "/admin/exams",
    title: "Exams",
    description: "QR codes, timeslots, sections, and grades for each exam.",
  },
  {
    href: "/admin/exams/new",
    title: "Create exam",
    description: "Start a new exam with a name and duration.",
  },
  {
    href: "/admin/review",
    title: "Review queue",
    description: "Mark text answers that are waiting for a teacher.",
  },
];

export default async function AdminHome() {
  await connection();

  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Staff tools for the admission exam. Only admins and teachers should
          reach this page.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block h-full rounded-lg text-foreground hover:no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Card className="h-full hover:border-primary">
              <CardHeader>
                <CardTitle className="text-base">{link.title}</CardTitle>
                <CardDescription className="leading-6">
                  {link.description}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
