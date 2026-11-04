import { TText } from "@/app/admin/T";
import type { ReactNode } from "react";

import { MathText } from "@/components/MathText";
import { formatHongKongDateTime } from "@/lib/hongKongTime";
import { Badge } from "@/components/ui/badge";
import { ConfirmAllButton, QuestionMarkControls } from "@/app/admin/review/MarkControls";

import {
  labels,
  markWord,
  questionRailLabel,
  teacherStateLabel,
} from "./labels";
import {
  confirmAllCount,
  judgementClass,
  railCellClass,
  wrongAnswerHighlighted,
  type ReviewQuestion,
} from "./marking";

function AnswerText({
  text,
  subject,
  category,
  empty,
}: {
  text: string;
  subject: string | null;
  category: string;
  empty: ReactNode;
}) {
  if (!text.trim()) return empty;
  return <MathText text={text} subject={subject} category={category} />;
}

export function ReviewPaper({
  questions,
  instanceId,
  markingReady,
  header,
}: {
  questions: ReviewQuestion[];
  instanceId: string;
  markingReady: boolean;
  header: ReactNode;
}) {
  const confirmCount = confirmAllCount(
    questions.map((question) => ({
      state: question.teacherState,
      responseId: question.responseId,
    })),
  );

  return (
    <div className="-mx-5 -my-10 flex items-start sm:-mx-8">
      <nav
        aria-label={labels.questionRail}
        className="sticky top-14 z-30 flex h-[calc(100svh-3.5rem)] w-12 shrink-0 flex-col overflow-y-auto border-r border-border bg-background"
      >
        {questions.map((question) => (
          <a
            key={`${question.number}-${question.id}`}
            href={`#question-${question.number}`}
            aria-label={questionRailLabel(question.number, question.verdict, question.teacherState)}
            className={railCellClass(question.verdict, question.teacherState)}
          >
            {question.number}
          </a>
        ))}
      </nav>
      <div className="min-w-0 flex-1 space-y-8 px-5 py-10 sm:px-8">
        {header}
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground"><TText text={labels.noQuestions} /></p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground"><TText text={labels.railLegend} /></p>
            {!markingReady ? (
              <p className="text-sm text-muted-foreground"><TText text={labels.markingWaiting} /></p>
            ) : (
              <ConfirmAllButton
                instanceId={instanceId}
                count={confirmCount}
                markingReady={markingReady}
              />
            )}
            <ol className="space-y-6">
              {questions.map((question) => {
                const wrong = wrongAnswerHighlighted(question.verdict);
                const subjectLine = [question.subject, question.category]
                  .map((part) => part?.trim() ?? "")
                  .filter(Boolean)
                  .join(" · ");
                const systemText = question.systemKnown
                  ? markWord(
                      question.systemVerdict === "correct"
                        ? true
                        : question.systemVerdict === "incorrect"
                          ? false
                          : null,
                    )
                  : labels.systemUnknown;
                return (
                  <li
                    key={`${question.number}-${question.id}`}
                    id={`question-${question.number}`}
                    className="scroll-mt-20 space-y-3 rounded-md border border-border p-4"
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
                      <p className="text-sm font-medium"><TText text={labels.studentAnswer} /></p>
                      <p className="whitespace-pre-wrap text-base">
                        <AnswerText
                          text={question.studentAnswer}
                          subject={question.subject}
                          category={question.category}
                          empty={<TText text={labels.emptyAnswer} />}
                        />
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium"><TText text={labels.systemJudgement} /></p>
                      {question.systemKnown ? (
                        <Badge
                          variant="outline"
                          className={judgementClass(
                            question.systemVerdict === "not-graded" && !question.responseId
                              ? "incorrect"
                              : question.systemVerdict,
                          )}
                        >
                          <TText text={systemText} />
                        </Badge>
                      ) : (
                        <p className="text-sm text-muted-foreground"><TText text={labels.systemUnknown} /></p>
                      )}
                    </div>
                    <div className="space-y-2 rounded-md border p-4">
                      <p className="text-sm font-medium"><TText text={labels.correctAnswer} /></p>
                      <p className="whitespace-pre-wrap text-base">
                        <AnswerText
                          text={question.correctAnswer}
                          subject={question.subject}
                          category={question.category}
                          empty={<TText text={labels.noCorrectAnswer} />}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium"><TText text={labels.teacherState} /></p>
                      <p className="text-sm">
                        <TText
                          text={teacherStateLabel({
                            state: question.teacherState,
                            who: question.markedByLabel,
                            when: formatHongKongDateTime(question.markedAt),
                          })}
                        />
                      </p>
                      {question.note ? (
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{question.note}</p>
                      ) : null}
                      {question.teacherState === "overridden" ? (
                        <p className="text-sm text-muted-foreground">
                          <TText text={`${labels.countsAs} ${markWord(question.finalCorrect)}.`} />
                        </p>
                      ) : null}
                      {question.needsReview ? <Badge variant="outline"><TText text={labels.needsTeacher} /></Badge> : null}
                    </div>
                    {question.responseId ? (
                      <QuestionMarkControls
                        responseId={question.responseId}
                        instanceId={instanceId}
                        markingReady={markingReady}
                        overridden={question.teacherState === "overridden"}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground"><TText text={labels.noStoredAnswer} /></p>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
