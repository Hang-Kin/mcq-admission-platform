"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { labels } from "@/app/admin/results/labels";

import {
  confirmAllResponses,
  confirmResponse,
  overrideResponse,
  type ReviewActionState,
} from "./actions";
import { finalizeGrade, type GradeActionState } from "../exams/[examId]/grades/actions";

export function ConfirmAllButton({
  instanceId,
  count,
  markingReady,
}: {
  instanceId: string;
  count: number;
  markingReady: boolean;
}) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(
    confirmAllResponses,
    null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="instance_id" value={instanceId} />
      <Button type="submit" disabled={pending || !markingReady || count === 0}>
        {pending ? labels.saving : labels.confirmAll(count)}
      </Button>
      <p className="text-sm text-muted-foreground">{labels.confirmAllDetail(count)}</p>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function QuestionMarkControls({
  responseId,
  instanceId,
  markingReady,
  overridden,
}: {
  responseId: string;
  instanceId: string;
  markingReady: boolean;
  overridden: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmState, confirmAction, confirmPending] = useActionState<ReviewActionState, FormData>(
    confirmResponse,
    null,
  );
  const [editState, editAction, editPending] = useActionState<ReviewActionState, FormData>(
    overrideResponse,
    null,
  );
  const pending = confirmPending || editPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <form action={confirmAction}>
          <input type="hidden" name="id" value={responseId} />
          <input type="hidden" name="instance_id" value={instanceId} />
          <Button type="submit" variant="outline" disabled={pending || !markingReady}>
            {confirmPending ? labels.saving : labels.confirm}
          </Button>
        </form>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          disabled={!markingReady}
          onClick={() => setOpen((current) => !current)}
        >
          {labels.edit}
        </Button>
      </div>
      {overridden ? <p className="text-sm text-muted-foreground">{labels.confirmClearsOverride}</p> : null}
      {open ? (
        <form action={editAction} className="space-y-3">
          <input type="hidden" name="id" value={responseId} />
          <input type="hidden" name="instance_id" value={instanceId} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{labels.editLegend}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="verdict" value="correct" required />
              {labels.markCorrect}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="verdict" value="incorrect" required />
              {labels.markIncorrect}
            </label>
          </fieldset>
          <label className="flex flex-col gap-2 text-sm">
            {labels.note}
            <textarea
              name="note"
              maxLength={500}
              rows={3}
              placeholder={labels.notePlaceholder}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
            />
          </label>
          <Button type="submit" disabled={pending || !markingReady}>
            {editPending ? labels.saving : labels.saveEdit}
          </Button>
        </form>
      ) : null}
      {confirmState?.error ? <p className="text-sm text-destructive">{confirmState.error}</p> : null}
      {editState?.error ? <p className="text-sm text-destructive">{editState.error}</p> : null}
    </div>
  );
}

export function FinalizeControl({
  examId,
  instanceId,
  alreadyFinalized,
}: {
  examId: string;
  instanceId: string;
  alreadyFinalized: boolean;
}) {
  const [state, action, pending] = useActionState<GradeActionState, FormData>(finalizeGrade, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="instance_id" value={instanceId} />
      <Button type="submit" disabled={pending}>
        {pending ? labels.finalizing : alreadyFinalized ? labels.refinalize : labels.finalize}
      </Button>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
    </form>
  );
}
