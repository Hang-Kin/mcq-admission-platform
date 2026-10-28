"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { prepareSitting } from "./actions";
import { sittingButton, type SittingStatus } from "./scheduleModel";
import { deleteSittingTime } from "./sittingsActions";

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
  startWarning = false,
  unavailable = false,
  prominent = false,
  canDelete = false,
  examId,
  children,
}: {
  sittingId: string;
  title: string;
  examName: string;
  startsAt: string | null;
  endsAt: string | null;
  status: SittingStatus;
  startWarning?: boolean;
  unavailable?: boolean;
  prominent?: boolean;
  canDelete?: boolean;
  examId?: string;
  children?: ReactNode;
}) {
  const button = sittingButton(status);
  const when = formatWhen(startsAt, endsAt);
  const cannotRun = button.disabled || unavailable;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cannotRun) return;
    if (button.force && !window.confirm(`Replace the questions for ${title}?`)) return;
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

  async function handleDelete() {
    if (!canDelete || !examId) return;
    if (!window.confirm(`Delete ${title}?`)) return;
    setError(null);
    setIsDeleting(true);
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("sitting_id", sittingId);
    try {
      const result = await deleteSittingTime(formData);
      if (result?.error) setError(result.error);
    } finally {
      setIsDeleting(false);
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
          {startWarning ? (
            <Badge variant="destructive">Within 24 hours</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {examName}
          {when ? ` · ${when}` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant={prominent && !cannotRun ? "default" : "outline"}
              className="h-12 px-5 text-base"
              disabled={cannotRun || isSubmitting}
            >
              {isSubmitting ? "Preparing…" : button.label}
            </Button>
            {canDelete && examId ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 px-5 text-base"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {children}
      </CardContent>
    </Card>
  );
}
