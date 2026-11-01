"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";

import { DrawPreview } from "./DrawPreview";
import { sittingQuestionSummary, type PreviewGroup } from "./scheduleModel";

export function SittingQuestions({ groups }: { groups: PreviewGroup[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const summary = sittingQuestionSummary(groups);
  if (!summary) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 px-5 text-base"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Hide questions" : "Show questions"}
        </Button>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>
      {open ? (
        <div id={panelId}>
          <DrawPreview groups={groups} />
        </div>
      ) : null}
    </div>
  );
}
