import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const instant = false;

const links = [
  {
    href: "/admin/exams/new",
    title: "Create exam",
    description: "Start a new exam with a name and duration.",
  },
  {
    href: "/admin/exams",
    title: "Exam setup",
    description: "QR codes, sitting times, and the older setup screens.",
  },
  {
    href: "/admin/questions",
    title: "Older question list",
    description: "The previous question list.",
  },
  {
    href: "/admin/questions/import",
    title: "Import questions",
    description: "Upload questions from a CSV file.",
  },
];

export default function AdvancedPage() {
  return (
    <main className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl">Advanced</h1>
        <p className="text-sm text-muted-foreground">
          Older setup screens stay here.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block h-full rounded-lg text-foreground hover:no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Card className="h-full min-h-28 hover:border-primary">
              <CardHeader>
                <CardTitle className="text-base">{link.title}</CardTitle>
                <CardDescription className="text-base leading-6">
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
