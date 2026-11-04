"use client";

import { T, TText } from "@/app/admin/T";
import { phraseNow } from "@/app/admin/usePhrase";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type DeleteBankQuestionButtonProps = {
  id: string;
  returnTo: string;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
};

export function DeleteBankQuestionButton({
  id,
  returnTo,
  action,
}: DeleteBankQuestionButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleClick() {
    if (!window.confirm(phraseNow("Delete this question? This cannot be undone."))) return;
    setError(null);
    setIsDeleting(true);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("return_to", returnTo);
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
        className="h-12 px-4 text-base"
        disabled={isDeleting}
        onClick={() => void handleClick()}
      >
        {isDeleting ? <T id="shell.copy.deleting" /> : <T id="shell.copy.delete" />}
      </Button>
      {error ? <p className="text-sm text-destructive"><TText text={error} /></p> : null}
    </div>
  );
}
