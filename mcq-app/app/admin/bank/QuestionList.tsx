import Link from "next/link";

import { Button } from "@/components/ui/button";

import { deleteBankQuestion } from "./actions";
import { answerKindLabel } from "./bankValidation";
import { DeleteBankQuestionButton } from "./DeleteBankQuestionButton";
import type { BankQuestionRow } from "./loadBank";
import type { SubjectId } from "./subjects";

function preview(question: BankQuestionRow): string {
  const answer = question.correct_answer?.trim() ?? "";
  if (question.type === "radio") return answer ? `Correct: ${answer}` : "No correct choice yet";
  if (question.type === "numeric" || question.type === "fraction") {
    return answer ? `Answer: ${answer}` : "No answer yet";
  }
  if (question.type === "text") return "Written answer";
  return answer;
}

export function QuestionList({
  questions,
  editHref,
  returnTo,
  emptyLabel = "No questions in this topic yet.",
}: {
  questions: BankQuestionRow[];
  editHref: (id: string) => string;
  returnTo: string;
  emptyLabel?: string;
}) {
  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {questions.map((question) => (
        <li
          key={question.id}
          className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <p className="text-base text-foreground">{question.question_text}</p>
            <p className="text-sm text-muted-foreground">
              {answerKindLabel(question.type)}
              {" · "}
              {preview(question)}
              {question.image_url ? " · File attached" : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline" className="h-12 px-4 text-base">
              <Link href={editHref(question.id)}>Edit</Link>
            </Button>
            <DeleteBankQuestionButton
              id={question.id}
              returnTo={returnTo}
              action={deleteBankQuestion}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function questionEditHref(subject: SubjectId, topic: string, id: string) {
  return `/admin/bank/${subject}/${encodeURIComponent(topic)}/${id}/edit`;
}
