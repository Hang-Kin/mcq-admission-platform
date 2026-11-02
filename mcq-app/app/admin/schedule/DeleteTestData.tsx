"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { labels } from "./labels";
import { canConfirmDelete } from "./sittingRules";
import { deleteSittingTestData, previewSittingDeletion } from "./sittingsActions";

export function DeleteTestData({
  examId,
  sittingId,
  title,
}: {
  examId: string;
  sittingId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"count" | "delete" | null>(null);
  const inputId = `delete-confirm-${sittingId}`;

  async function openPanel() {
    setError(null);
    setPending("count");
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("sitting_id", sittingId);
    const result = await previewSittingDeletion(formData);
    setPending(null);
    if (result?.error || !result?.summary) {
      setError(result?.error ?? labels.deleteCountFailed);
      setOpen(false);
      return;
    }
    setSummary(result.summary);
    setTyped("");
    setOpen(true);
  }

  async function confirmDelete() {
    if (!canConfirmDelete(typed)) {
      setError(labels.deleteWordMismatch);
      return;
    }
    setError(null);
    setPending("delete");
    const formData = new FormData();
    formData.set("exam_id", examId);
    formData.set("sitting_id", sittingId);
    formData.set("confirm", typed);
    const result = await deleteSittingTestData(formData);
    setPending(null);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="destructive"
        className="h-12 px-5 text-base"
        disabled={pending !== null}
        onClick={() => void openPanel()}
      >
        {pending === "count" ? labels.countingTestData : labels.deleteTestData}
      </Button>
      {open && summary ? (
        <div className="max-w-xl space-y-3 rounded-md border border-destructive p-4">
          <p className="text-sm">{summary}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>{labels.deleteWordLabel}</Label>
            <Input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirmDelete(typed) || pending !== null}
            onClick={() => void confirmDelete()}
          >
            {pending === "delete" ? labels.deletingTestData : labels.deleteTestData}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
