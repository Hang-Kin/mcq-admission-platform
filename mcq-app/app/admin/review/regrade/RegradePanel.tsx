"use client";

import { TText } from "@/app/admin/T";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { labels } from "@/app/admin/results/labels";

import { applyRegrade, type ReviewActionState } from "../actions";

export function RegradePanel({
  questionId,
  beforeKnown,
  beforeNull,
  before,
  canApply,
}: {
  questionId: string;
  beforeKnown: boolean;
  beforeNull: boolean;
  before: string;
  canApply: boolean;
}) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(applyRegrade, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="question_id" value={questionId} />
      <input type="hidden" name="before_known" value={beforeKnown ? "1" : "0"} />
      <input type="hidden" name="before_null" value={beforeNull ? "1" : "0"} />
      {beforeKnown && !beforeNull ? <input type="hidden" name="before" value={before} /> : null}
      <Button type="submit" disabled={pending || !canApply}>
        {pending ? <TText text={labels.applying} /> : <TText text={labels.regradeApply} />}
      </Button>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
