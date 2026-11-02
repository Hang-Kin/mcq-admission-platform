"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicQuestionImagePath } from "@/app/admin/questions/questionImages";
import { MathText } from "@/components/MathText";
import { cn } from "@/lib/utils";

import {
  canFinishSection,
  canSubmitExam,
  isBlankAnswer,
  unansweredCount,
  type SessionQuestion,
} from "./examProgress";
import { FractionAnswerFields } from "./FractionAnswerFields";
import {
  examLabels,
  finishSectionButtonLabel,
  questionJumpLabel,
  questionProgressLabel,
  unansweredCountLabel,
} from "./labels.js";
import type { ExamSectionState } from "./sectionSession";

const touchButton =
  "h-auto min-h-11 touch-manipulation whitespace-normal px-4 py-2 text-center text-base";
const answerField = "h-11 min-h-11 text-base md:text-base";

type ExamChromeProps = {
  questions: SessionQuestion[];
  index: number;
  answers: Record<string, string>;
  section: ExamSectionState | null;
  remainingLabel: string;
  autosaveLabel: string;
  sectionNotice: string | null;
  advanceBusy: boolean;
  submitBusy: boolean;
  finishConfirmOpen: boolean;
  submitConfirmOpen: boolean;
  fraction: {
    numerator: string;
    denominator: string;
    message: string | null;
  } | null;
  onSelectQuestion: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAnswer: (questionId: string, value: string) => void;
  onFractionPart: (part: "numerator" | "denominator", value: string) => void;
  onOpenFinish: () => void;
  onOpenSubmit: () => void;
  onCancelFinish: () => void;
  onCancelSubmit: () => void;
  onConfirmFinish: () => void;
  onConfirmSubmit: () => void;
};

function optionList(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.map((option) => String(option)).filter((option) => option.length > 0);
  }
  if (typeof options === "string") {
    try {
      return optionList(JSON.parse(options));
    } catch {
      return [];
    }
  }
  return [];
}

function sanitizeNumeric(value: string) {
  let next = value.replace(/[^0-9.-]/g, "");
  const minus = next.startsWith("-") ? "-" : "";
  next = next.replace(/-/g, "");
  const parts = next.split(".");
  if (parts.length > 1) {
    next = `${parts[0]}.${parts.slice(1).join("")}`;
  }
  return minus + next;
}

function ConfirmDialog({
  titleId,
  title,
  body,
  extra,
  unanswered,
  cancelLabel,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  titleId: string;
  title: string;
  body: string;
  extra: string | null;
  unanswered: string | null;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 sm:items-center sm:p-6">
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md"
      >
        <CardHeader>
          <CardTitle id={titleId} className="text-xl leading-snug">
            {title}
          </CardTitle>
          <CardDescription className="text-base leading-relaxed text-foreground">
            {body}
          </CardDescription>
          {extra ? (
            <p className="text-base leading-relaxed text-foreground">{extra}</p>
          ) : null}
          {unanswered ? (
            <p className="text-base font-medium text-foreground">{unanswered}</p>
          ) : null}
        </CardHeader>
        <CardFooter className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className={touchButton}
            disabled={busy}
            autoFocus
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button type="button" className={touchButton} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export function ExamChrome({
  questions,
  index,
  answers,
  section,
  remainingLabel,
  autosaveLabel,
  sectionNotice,
  advanceBusy,
  submitBusy,
  finishConfirmOpen,
  submitConfirmOpen,
  fraction,
  onSelectQuestion,
  onPrevious,
  onNext,
  onAnswer,
  onFractionPart,
  onOpenFinish,
  onOpenSubmit,
  onCancelFinish,
  onCancelSubmit,
  onConfirmFinish,
  onConfirmSubmit,
}: ExamChromeProps) {
  const question = questions[index];
  if (!question) return null;

  const total = questions.length;
  const hasSection = section !== null;
  const showFinish = canFinishSection(index, total, hasSection);
  const showSubmit = canSubmitExam(index, total, hasSection);
  const unanswered = unansweredCountLabel(unansweredCount(questions, answers));
  const options = optionList(question.options);
  const value = answers[question.id] ?? "";
  const locked = advanceBusy;

  return (
    <main className="-mx-5 -my-10 flex min-h-[calc(100svh-3.5rem)] min-w-0 flex-col sm:-mx-8">
      <header className="sticky top-14 z-20 border-b border-border bg-background px-5 py-4 sm:px-8">
        <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {section ? (
              <p className="break-words text-base font-medium text-primary">
                {section.label}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {questionProgressLabel(index + 1, total)}
            </p>
          </div>
          <p className="shrink-0 text-2xl font-medium tabular-nums text-primary sm:text-3xl">
            <span className="sr-only">{examLabels.timeRemaining} </span>
            {remainingLabel}
          </p>
        </div>
        <p className="mt-2 min-h-5 break-words text-sm text-muted-foreground">
          {autosaveLabel}
        </p>
        <nav
          aria-label={examLabels.questions}
          className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto overscroll-contain"
        >
          {questions.map((item, itemIndex) => {
            const current = itemIndex === index;
            const answered = !isBlankAnswer(answers[item.id]);
            return (
              <button
                key={item.id}
                type="button"
                aria-current={current ? "true" : undefined}
                aria-label={questionJumpLabel(itemIndex + 1, answered)}
                disabled={locked}
                onClick={() => onSelectQuestion(itemIndex)}
                className={cn(
                  "inline-flex h-11 min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-md border px-2 text-base font-medium tabular-nums",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                  current
                    ? "border-primary bg-primary text-primary-foreground"
                    : answered
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "border-border bg-background text-foreground",
                )}
              >
                {itemIndex + 1}
              </button>
            );
          })}
        </nav>
        </div>
      </header>

      <div className="min-w-0 flex-1 px-5 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto w-full max-w-3xl">
        {sectionNotice ? (
          <p className="mb-4 break-words text-base text-muted-foreground">
            {sectionNotice}
          </p>
        ) : null}
        <Card className="w-full">
          <CardHeader className="p-5 sm:p-6">
            <CardTitle className="break-words text-lg font-medium leading-relaxed sm:text-xl">
              <MathText
                text={question.question_text}
                subject={question.subject}
                category={question.category}
                className="whitespace-pre-wrap break-words"
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
            {question.image_url && publicQuestionImagePath(question.image_url) ? (
              // Public bucket URL from start_session. Loaded directly so it does not need a Next image host.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={question.image_url}
                alt=""
                className="mx-auto h-auto max-h-96 w-full max-w-full rounded-md object-contain"
              />
            ) : null}
            {question.type === "radio" ? (
              <fieldset className="space-y-3">
                <legend className="sr-only">{examLabels.chooseAnswer}</legend>
                {options.map((option) => {
                  const id = `${question.id}-${option}`;
                  const selected = value === option;
                  return (
                    <label
                      key={option}
                      htmlFor={id}
                      className={cn(
                        "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-base leading-relaxed",
                        "focus-within:ring-1 focus-within:ring-ring",
                        selected
                          ? "border-primary bg-secondary text-secondary-foreground ring-1 ring-primary"
                          : "border-border bg-background",
                      )}
                    >
                      <input
                        id={id}
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={selected}
                        disabled={locked}
                        onChange={() => onAnswer(question.id, option)}
                        className="size-5 shrink-0"
                      />
                      <span className="min-w-0 flex-1 break-words">
                        <MathText
                          text={option}
                          subject={question.subject}
                          category={question.category}
                          className="whitespace-pre-wrap break-words"
                        />
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ) : null}

            {question.type === "numeric" ? (
              <div className="space-y-2">
                <Label htmlFor="numeric-answer" className="text-base">
                  {examLabels.numericAnswer}
                </Label>
                <Input
                  id="numeric-answer"
                  inputMode="decimal"
                  autoComplete="off"
                  value={value}
                  disabled={locked}
                  className={answerField}
                  onChange={(event) =>
                    onAnswer(question.id, sanitizeNumeric(event.target.value))
                  }
                />
              </div>
            ) : null}

            {question.type === "fraction" && fraction ? (
              <FractionAnswerFields
                numerator={fraction.numerator}
                denominator={fraction.denominator}
                message={fraction.message}
                disabled={locked}
                onNumeratorChange={(next) => onFractionPart("numerator", next)}
                onDenominatorChange={(next) => onFractionPart("denominator", next)}
              />
            ) : null}

            {question.type === "text" ? (
              <div className="space-y-2">
                <Label htmlFor="text-answer" className="text-base">
                  {examLabels.textAnswer}
                </Label>
                <textarea
                  id="text-answer"
                  value={value}
                  disabled={locked}
                  onChange={(event) => onAnswer(question.id, event.target.value)}
                  className="min-h-32 w-full break-words rounded-md border border-input bg-background px-3 py-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
        </div>
      </div>

      <footer className="sticky bottom-0 z-20 mt-auto border-t border-border bg-background px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="mx-auto w-full max-w-3xl">
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className={touchButton}
            disabled={index === 0 || locked}
            onClick={onPrevious}
          >
            {examLabels.previous}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={touchButton}
            disabled={index >= total - 1 || locked}
            onClick={onNext}
          >
            {examLabels.next}
          </Button>
        </div>
        {showFinish && section ? (
          <div className="mt-3 w-full">
            <Button
              type="button"
              className={cn(touchButton, "w-full")}
              disabled={locked}
              onClick={onOpenFinish}
            >
              {locked ? examLabels.finishing : finishSectionButtonLabel(section.label)}
            </Button>
          </div>
        ) : null}
        {showSubmit ? (
          <div className="mt-3 w-full">
            <Button
              type="button"
              className={cn(touchButton, "w-full")}
              disabled={submitBusy}
              onClick={onOpenSubmit}
            >
              {submitBusy ? examLabels.submitting : examLabels.submitExam}
            </Button>
          </div>
        ) : null}
        </div>
      </footer>

      {finishConfirmOpen && showFinish && section ? (
        <ConfirmDialog
          titleId="finish-section-title"
          title={examLabels.finishTitle}
          body={examLabels.finishBody}
          extra={section.isLast ? examLabels.finishSubmitsExam : null}
          unanswered={unanswered}
          cancelLabel={examLabels.cancel}
          confirmLabel={advanceBusy ? examLabels.finishing : examLabels.finishNow}
          busy={advanceBusy}
          onCancel={onCancelFinish}
          onConfirm={onConfirmFinish}
        />
      ) : null}

      {submitConfirmOpen && showSubmit ? (
        <ConfirmDialog
          titleId="submit-exam-title"
          title={examLabels.submitTitle}
          body={examLabels.submitBody}
          extra={null}
          unanswered={unanswered}
          cancelLabel={examLabels.cancel}
          confirmLabel={submitBusy ? examLabels.submitting : examLabels.submitNow}
          busy={submitBusy}
          onCancel={onCancelSubmit}
          onConfirm={onConfirmSubmit}
        />
      ) : null}
    </main>
  );
}
