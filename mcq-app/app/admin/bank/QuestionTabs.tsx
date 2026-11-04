"use client";

import { T } from "@/app/admin/T";
import { usePhrase } from "@/app/admin/usePhrase";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function QuestionTabs({ settings }: { settings: boolean }) {
  const tx = usePhrase();
  return (
    <div className="flex gap-6 border-b border-border" role="tablist" aria-label={tx("Questions")}>
      <Link
        href="/admin/bank"
        role="tab"
        aria-selected={!settings}
        className={tabClass(!settings)}
      ><T id="shell.nav.questions" /></Link>
      <Link
        href="/admin/bank?tab=settings"
        role="tab"
        aria-selected={settings}
        className={tabClass(settings)}
      ><T id="shell.group.subjectSettings" /></Link>
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
