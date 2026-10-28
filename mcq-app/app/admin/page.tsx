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
    href: "/admin/bank",
    title: "Question bank",
    description: "Add and edit Math and Chinese questions by topic.",
  },
  {
    href: "/admin/students",
    title: "Students",
    description: "Add names and application numbers to the roster.",
  },
  {
    href: "/admin/exams",
    title: "Exams",
    description: "QR codes and grades for each exam.",
  },
  {
    href: "/admin/review",
    title: "Review queue",
    description: "Mark written answers that are waiting for a teacher.",
  },
  {
    href: "/admin/advanced",
    title: "Advanced",
    description: "Create an exam and open the older setup screens.",
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
            <Card className="h-full min-h-28 hover:border-primary">
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
