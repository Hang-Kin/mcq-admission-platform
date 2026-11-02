"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHongKongRange } from "@/lib/hongKongTime";

import { prepareSitting } from "./actions";
import { DeleteTestData } from "./DeleteTestData";
import { labels } from "./labels";
import { sittingButton, type SittingStatus } from "./scheduleModel";
import { EditTimeForm } from "./SittingsForms";
import type { SittingControls, SittingWindow } from "./sittingRules";
import { deleteSittingTime, setSittingArchived } from "./sittingsActions";

export function SittingCard({
  sittingId,
  title,
  examName,
  startsAt,
  endsAt,
  status,
  startWarning = false,
  lengthWarning = null,
  unavailable = false,
  prominent = false,
  canDelete = false,
  examId,
  archived = false,
  controls,
  peers = [],
  examMinutes = 0,
  children,
}: {
  sittingId: string;
  title: string;
  examName: string;
  startsAt: string | null;
  endsAt: string | null;
  status: SittingStatus;
  startWarning?: boolean;
  lengthWarning?: string | null;
  unavailable?: boolean;
  prominent?: boolean;
  canDelete?: boolean;
  examId?: string;
  archived?: boolean;
  controls?: SittingControls;
  peers?: SittingWindow[];
  examMinutes?: number;
  children?: ReactNode;
}) {
  const button = sittingButton(status);
  const when = formatHongKongRange(startsAt, endsAt);
  const cannotRun = button.disabled || unavailable;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const showDelete = controls ? controls.deleteTime : canDelete;
  const showArchive = controls?.archive === true;
  const showRestore = controls?.restore === true;
  const showTestData = controls?.deleteTestData === true;
  const showEdit = controls?.editTime === true;

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

  async function handleArchive(nextArchived: boolean) {
    if (!examId) return;
    const message = nextArchived ? labels.archiveConfirm(title) : labels.restoreConfirm(title);
    if (!window.confirm(message)) return;
    setError(null);
    setIsArchiving(true);
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("sitting_id", sittingId);
    formData.set("archived", nextArchived ? "1" : "0");
    try {
      const result = await setSittingArchived(formData);
      if (result?.error) setError(result.error);
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleDelete() {
    if (!showDelete || !examId) return;
    if (!window.confirm(labels.deleteTimeConfirm(title))) return;
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
    <Card id={`sitting-${sittingId}`} className="scroll-mt-24">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-xl">{title}</CardTitle>
          <Badge variant={status === "Prepared" ? "default" : status === "Locked" ? "outline" : "secondary"}>
            {status}
          </Badge>
          {archived ? <Badge variant="outline">{labels.archived}</Badge> : null}
          {startWarning ? (
            <Badge variant="destructive">Within 24 hours</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {examName}
          {when ? ` · ${when}` : ""}
        </p>
        {lengthWarning ? <p className="text-sm text-destructive">{lengthWarning}</p> : null}
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
            {showDelete && examId ? (
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
            {showArchive && examId ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 px-5 text-base"
                disabled={isArchiving}
                onClick={() => void handleArchive(true)}
              >
                {isArchiving ? labels.archiving : labels.archive}
              </Button>
            ) : null}
            {showRestore && examId ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 px-5 text-base"
                disabled={isArchiving}
                onClick={() => void handleArchive(false)}
              >
                {isArchiving ? labels.restoring : labels.restore}
              </Button>
            ) : null}
          </div>
        </form>
        {showTestData && examId ? (
          <DeleteTestData examId={examId} sittingId={sittingId} title={title} />
        ) : null}
        {showEdit && examId ? (
          <details className="max-w-xl">
            <summary className="cursor-pointer text-sm text-primary">{labels.changeTime}</summary>
            <EditTimeForm
              key={`${sittingId}-${startsAt ?? ""}-${endsAt ?? ""}-${title}`}
              examId={examId}
              sittingId={sittingId}
              title={title}
              startsAt={startsAt}
              endsAt={endsAt}
              examMinutes={examMinutes}
              peers={peers}
            />
          </details>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {children}
      </CardContent>
    </Card>
  );
}
