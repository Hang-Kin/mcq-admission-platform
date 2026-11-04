"use client";

import { T } from "@/app/admin/T";

import Link, { useLinkStatus } from "next/link";

import { Button, ButtonSpinner } from "@/components/ui/button";

export function ImportStudentsLink() {
  return (
    <Button asChild size="lg" className="h-12 w-full px-8 text-base sm:w-fit">
      <Link href="/admin/students/import">
        <ImportStudentsLinkLabel />
      </Link>
    </Button>
  );
}

function ImportStudentsLinkLabel() {
  const { pending } = useLinkStatus();
  if (!pending) return <T id="shell.copy.import" />;
  return (
    <span className="inline-flex items-center gap-2" aria-busy="true">
      <ButtonSpinner /><T id="shell.copy.opening" /></span>
  );
}
