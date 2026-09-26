"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import {
  correctResponse,
  finalizeGrade,
  type GradeActionState,
} from "../actions";

export function CorrectionActions({
  responseId,
  examId,
  instanceId,
  isCorrect,
}: {
  responseId: string;
  examId: string;
  instanceId: string;
  isCorrect: boolean | null;
}) {
  const [state, action, pending] = useActionState<GradeActionState, FormData>(
    correctResponse,
    null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={responseId} />
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="instance_id" value={instanceId} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="verdict"
          value="correct"
          size="sm"
          variant={isCorrect === true ? "default" : "outline"}
          disabled={pending}
        >
          Mark correct
        </Button>
        <Button
          type="submit"
          name="verdict"
          value="incorrect"
          size="sm"
          variant={isCorrect === false ? "default" : "outline"}
          disabled={pending}
        >
          Mark incorrect
        </Button>
      </div>
      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

export function FinalizeGradeButton({
  examId,
  instanceId,
  alreadyFinalized,
}: {
  examId: string;
  instanceId: string;
  alreadyFinalized: boolean;
}) {
  const [state, action, pending] = useActionState<GradeActionState, FormData>(
    finalizeGrade,
    null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="instance_id" value={instanceId} />
      <Button type="submit" disabled={pending}>
        {pending
          ? "Finalizing…"
          : alreadyFinalized
            ? "Re-finalize grade"
            : "Finalize grade"}
      </Button>
      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.message ? (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      ) : null}
    </form>
  );
}
