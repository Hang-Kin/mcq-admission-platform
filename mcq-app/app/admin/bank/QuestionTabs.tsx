import Link from "next/link";

import { cn } from "@/lib/utils";

export function QuestionTabs({ settings }: { settings: boolean }) {
  return (
    <div className="flex gap-6 border-b border-border" role="tablist" aria-label="Questions">
      <Link
        href="/admin/bank"
        role="tab"
        aria-selected={!settings}
        className={tabClass(!settings)}
      >
        Questions
      </Link>
      <Link
        href="/admin/bank?tab=settings"
        role="tab"
        aria-selected={settings}
        className={tabClass(settings)}
      >
        Subject settings
      </Link>
    </div>
  );
}

function tabClass(active: boolean) {
  return cn(
    "-mb-px border-b-2 px-1 pb-2 text-sm hover:no-underline",
    active
      ? "border-primary font-medium text-primary"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}
