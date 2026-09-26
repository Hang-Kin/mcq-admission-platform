"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type DeleteQuestionButtonProps = {
  id: string;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
};

export function DeleteQuestionButton({ id, action }: DeleteQuestionButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleClick() {
    if (!window.confirm("Delete this question?")) return;
    setError(null);
    setIsDeleting(true);
    const formData = new FormData();
    formData.set("id", id);
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={isDeleting}
        onClick={() => void handleClick()}
      >
        {isDeleting ? "Deleting…" : "Delete"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
