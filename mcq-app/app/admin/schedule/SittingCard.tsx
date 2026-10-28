"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { prepareSitting } from "./actions";
import { sittingButton, type SittingStatus } from "./scheduleModel";

function formatWhen(starts: string | null, ends: string | null) {
  if (!starts || !ends) return "";
  const start = new Date(starts);
  const end = new Date(ends);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  return `${start.toLocaleString()} – ${end.toLocaleString()}`;
}

export function SittingCard({
  sittingId,
  title,
  examName,
  startsAt,
  endsAt,
  status,
  unavailable = false,
  children,
}: {
  sittingId: string;
  title: string;
  examName: string;
  startsAt: string | null;
  endsAt: string | null;
  status: SittingStatus;
  unavailable?: boolean;
  children?: ReactNode;
}) {
  const button = sittingButton(status);
  const when = formatWhen(startsAt, endsAt);
  const cannotRun = button.disabled || unavailable;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cannotRun) return;
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("sitting_id", sittingId);
    if (button.force) formData.set("force", "1");
    try {
      const result = await prepareSitting(formData);
      if (result?.error) setError(result.error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-xl">{title}</CardTitle>
          <Badge variant={status === "Prepared" ? "default" : status === "Locked" ? "outline" : "secondary"}>
            {status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {examName}
          {when ? ` · ${when}` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit}>
          <Button
            type="submit"
            variant={cannotRun ? "outline" : "default"}
            className="h-12 px-5 text-base"
            disabled={cannotRun || isSubmitting}
          >
            {isSubmitting ? "Preparing…" : button.label}
          </Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {children}
      </CardContent>
    </Card>
  );
}
