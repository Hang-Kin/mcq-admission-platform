"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { reviewResponse, type ReviewActionState } from "./actions";

export function ReviewActions({ responseId }: { responseId: string }) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(
    reviewResponse,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={responseId} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="verdict"
          value="correct"
          disabled={pending}
        >
          {pending ? "Saving…" : "Mark correct"}
        </Button>
        <Button
          type="submit"
          name="verdict"
          value="incorrect"
          variant="outline"
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
