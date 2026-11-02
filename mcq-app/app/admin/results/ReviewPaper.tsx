import { MathText } from "@/components/MathText";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { wrongAnswerHighlighted, type ReviewQuestion, type ReviewVerdict } from "./marking";

function numberClass(verdict: ReviewVerdict) {
  if (verdict === "correct") return "bg-primary text-primary-foreground";
  if (verdict === "incorrect") return "bg-destructive text-destructive-foreground";
  return "border border-border bg-muted text-foreground";
}

function verdictLabel(verdict: ReviewVerdict) {
  if (verdict === "correct") return "Correct";
  if (verdict === "incorrect") return "Incorrect";
  return "Not graded";
}

function verdictWords(verdict: ReviewVerdict) {
  if (verdict === "correct") return "correct";
  if (verdict === "incorrect") return "incorrect";
  return "not graded";
}

function AnswerText({
  text,
  subject,
  category,
  empty,
}: {
  text: string;
  subject: string | null;
  category: string;
  empty: string;
}) {
  if (!text.trim()) return empty;
  return <MathText text={text} subject={subject} category={category} />;
}

export function ReviewPaper({ questions }: { questions: ReviewQuestion[] }) {
  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">No questions on this sitting.</p>;
  }

  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-8">
      <nav
        aria-label="Question numbers"
        className="sticky top-20 z-30 flex max-h-[calc(100svh-6rem)] flex-col gap-1 overflow-y-auto bg-background py-1"
      >
        {questions.map((question) => (
          <a
            key={`${question.number}-${question.id}`}
            href={`#question-${question.number}`}
            aria-label={`Question ${question.number}, ${verdictWords(question.verdict)}`}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium no-underline",
              numberClass(question.verdict),
            )}
          >
            {question.number}
          </a>
        ))}
      </nav>
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Filled numbers are correct. Red numbers are incorrect. Grey numbers are not graded yet.
        </p>
        <ol className="space-y-6">
          {questions.map((question) => {
            const wrong = wrongAnswerHighlighted(question.verdict);
            const subjectLine = [question.subject, question.category]
              .map((part) => part?.trim() ?? "")
              .filter(Boolean)
              .join(" · ");
            return (
              <li
                key={`${question.number}-${question.id}`}
                id={`question-${question.number}`}
                className="scroll-mt-24 space-y-3 rounded-md border border-border p-4"
              >
                <div className="space-y-2">
                  <h2 className="text-base font-medium">
                    {question.number}.{" "}
                    <MathText
                      text={question.questionText}
                      subject={question.subject}
                      category={question.category}
                    />
                  </h2>
                  {subjectLine ? (
                    <p className="text-sm text-muted-foreground">{subjectLine}</p>
                  ) : null}
                </div>
                <div
                  className={
                    wrong
                      ? "space-y-2 rounded-md border border-destructive bg-destructive/10 p-4"
                      : "space-y-2 rounded-md border bg-muted/40 p-4"
                  }
                >
                  <p className="text-sm font-medium">Student answer</p>
                  <p className="whitespace-pre-wrap text-base">
                    <AnswerText
                      text={question.studentAnswer}
                      subject={question.subject}
                      category={question.category}
                      empty="(empty answer)"
                    />
                  </p>
                </div>
                <div className="space-y-2 rounded-md border p-4">
                  <p className="text-sm font-medium">Correct answer</p>
                  <p className="whitespace-pre-wrap text-base">
                    <AnswerText
                      text={question.correctAnswer}
                      subject={question.subject}
                      category={question.category}
                      empty="(none stored)"
                    />
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={wrong ? "destructive" : question.verdict === "correct" ? "default" : "secondary"}>
                    {verdictLabel(question.verdict)}
                  </Badge>
                  {question.needsReview ? <Badge variant="outline">Needs a teacher</Badge> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
