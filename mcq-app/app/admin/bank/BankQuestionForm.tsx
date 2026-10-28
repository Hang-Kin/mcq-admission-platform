"use client";

import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { attachmentError, publicQuestionImagePath } from "./attachments";
import { AttachmentPreview } from "./AttachmentPreview";
import { MAX_CHOICES } from "./bankValidation";
import { fractionCheck, splitFraction } from "./fraction";
import type { SubjectId } from "./subjects";

const fieldClass =
  "flex h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type AnswerKind = "choice" | "number" | "fraction" | "text";

export type BankQuestionValues = {
  id: string;
  question_text: string;
  type: string;
  options: unknown;
  correct_answer: string | null;
  image_url: string | null;
};

type BankQuestionFormProps = {
  subject: SubjectId;
  topic: string;
  filing?: boolean;
  question?: BankQuestionValues;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
};

function kindFromType(type: string): AnswerKind {
  if (type === "numeric") return "number";
  if (type === "fraction") return "fraction";
  if (type === "text") return "text";
  return "choice";
}

function choiceValues(options: unknown): string[] {
  const values = Array.isArray(options) ? options.map((value) => String(value)) : [];
  while (values.length < 2) values.push("");
  return values.slice(0, MAX_CHOICES);
}

function correctIndex(options: string[], correctAnswer: string | null | undefined) {
  if (!correctAnswer) return 0;
  const index = options.findIndex((option) => option === correctAnswer);
  return index >= 0 ? index : 0;
}

export function BankQuestionForm({
  subject,
  topic,
  filing = false,
  question,
  action,
}: BankQuestionFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const initialOptions = choiceValues(question?.options);
  const initialFraction = splitFraction(
    question?.type === "fraction" ? question.correct_answer : "",
  );
  const allowWritten = question?.type === "text";
  const [questionText, setQuestionText] = useState(question?.question_text ?? "");
  const [topicName, setTopicName] = useState(filing ? "" : topic);
  const [kind, setKind] = useState<AnswerKind>(
    question ? kindFromType(question.type) : "choice",
  );
  const [options, setOptions] = useState<string[]>(initialOptions);
  const [correctOption, setCorrectOption] = useState(() =>
    correctIndex(initialOptions, question?.correct_answer),
  );
  const [numberAnswer, setNumberAnswer] = useState(
    question?.type === "numeric" ? (question.correct_answer ?? "") : "",
  );
  const [writtenAnswer, setWrittenAnswer] = useState(
    question?.type === "text" ? (question.correct_answer ?? "") : "",
  );
  const [fractionA, setFractionA] = useState(initialFraction.a);
  const [fractionB, setFractionB] = useState(initialFraction.b);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingAttachment =
    question?.image_url && publicQuestionImagePath(question.image_url)
      ? question.image_url
      : null;
  const fraction = fractionCheck(fractionA, fractionB);

  function updateOption(index: number, value: string) {
    setOptions((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? value : option)),
    );
  }

  function addOption() {
    setOptions((current) => (current.length >= MAX_CHOICES ? current : [...current, ""]));
  }

  function removeOption(index: number) {
    setOptions((current) =>
      current.length <= 2
        ? current
        : current.filter((_, optionIndex) => optionIndex !== index),
    );
    setCorrectOption((current) => {
      if (current === index) return 0;
      if (current > index) return current - 1;
      return current;
    });
  }

  function clearForm() {
    setQuestionText("");
    setKind("choice");
    setOptions(["", ""]);
    setCorrectOption(0);
    setNumberAnswer("");
    setWrittenAnswer("");
    setFractionA("");
    setFractionB("");
    setRemoveAttachment(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const file = fileRef.current?.files?.[0];
    if (file && file.size > 0) {
      const problem = attachmentError(file);
      if (problem) {
        setError(problem);
        return;
      }
    }

    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("topic", filing ? topicName : topic);
    if (filing) formData.set("filing", "1");
    if (question) formData.set("id", question.id);
    formData.set("question_text", questionText);
    formData.set("answer_kind", kind);

    if (kind === "choice") {
      formData.set("options", JSON.stringify(options));
      formData.set("correct_answer", options[correctOption] ?? "");
    } else if (kind === "number") {
      formData.set("correct_answer", numberAnswer);
    } else if (kind === "text") {
      formData.set("correct_answer", writtenAnswer);
    } else {
      formData.set("fraction_a", fractionA);
      formData.set("fraction_b", fractionB);
    }

    if (file && file.size > 0) formData.set("attachment", file);
    if (removeAttachment) formData.set("remove_attachment", "1");

    setIsSubmitting(true);
    try {
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (!question) {
        clearForm();
        setSuccess("Question saved.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      {filing ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="topic">Topic</Label>
          <Input
            id="topic"
            value={topicName}
            onChange={(event) => setTopicName(event.target.value)}
            placeholder="Fractions"
            className="h-12 text-base md:text-base"
          />
          <p className="text-sm text-muted-foreground">
            Leave this blank to keep the question out of a topic, or type a topic
            to file it.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="question_text">Question</Label>
        <textarea
          id="question_text"
          required
          value={questionText}
          onChange={(event) => setQuestionText(event.target.value)}
          className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="attachment">Image or PDF</Label>
        {existingAttachment && !removeAttachment ? (
          <AttachmentPreview url={existingAttachment} />
        ) : null}
        <input
          ref={fileRef}
          id="attachment"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          className="block w-full text-base"
        />
        <p className="text-sm text-muted-foreground">
          Optional. PNG, JPEG, WEBP, GIF, or PDF, up to 5 MB.
        </p>
        {existingAttachment ? (
          <label className="flex min-h-11 items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={removeAttachment}
              onChange={(event) => setRemoveAttachment(event.target.checked)}
            />
            Remove the current file
          </label>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="answer_kind">Answer type</Label>
        <select
          id="answer_kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as AnswerKind)}
          className={fieldClass}
        >
          <option value="choice">Choice</option>
          <option value="number">Number</option>
          <option value="fraction">Fraction</option>
          {allowWritten ? <option value="text">Written answer</option> : null}
        </select>
      </div>

      {kind === "choice" ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">Choices</legend>
          <p className="text-sm text-muted-foreground">
            Enter at least two choices and mark the correct one.
          </p>
          {options.map((option, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex min-h-11 shrink-0 items-center gap-3 text-base">
                <input
                  type="radio"
                  name="correct_choice"
                  checked={correctOption === index}
                  onChange={() => setCorrectOption(index)}
                  aria-label={`Mark choice ${index + 1} as correct`}
                />
                Correct
              </label>
              <Input
                value={option}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={`Choice ${index + 1}`}
                className="h-12 min-w-0 flex-1 text-base md:text-base"
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 px-4 text-base"
                disabled={options.length <= 2}
                onClick={() => removeOption(index)}
              >
                Remove choice
              </Button>
            </div>
          ))}
          {options.length < MAX_CHOICES ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 px-4 text-base"
              onClick={addOption}
            >
              Add a choice
            </Button>
          ) : null}
        </fieldset>
      ) : null}

      {kind === "number" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="number_answer">Correct answer</Label>
          <Input
            id="number_answer"
            inputMode="decimal"
            value={numberAnswer}
            onChange={(event) => setNumberAnswer(event.target.value)}
            className="h-12 text-base md:text-base"
          />
        </div>
      ) : null}

      {kind === "fraction" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Enter a simplified fraction. 1/3 is saved. 2/6 is not.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fraction_a">a</Label>
              <Input
                id="fraction_a"
                inputMode="text"
                value={fractionA}
                onChange={(event) => setFractionA(event.target.value)}
                className="h-12 text-base md:text-base"
              />
              <p className="text-sm text-muted-foreground">Numerator</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fraction_b">b</Label>
              <Input
                id="fraction_b"
                inputMode="text"
                value={fractionB}
                onChange={(event) => setFractionB(event.target.value)}
                className="h-12 text-base md:text-base"
              />
              <p className="text-sm text-muted-foreground">Denominator</p>
            </div>
          </div>
          <p
            aria-live="polite"
            className={
              fraction.kind === "simplified"
                ? "text-sm text-primary"
                : fraction.kind === "empty"
                  ? "text-sm text-muted-foreground"
                  : "text-sm text-destructive"
            }
          >
            {fraction.message}
          </p>
        </div>
      ) : null}

      {kind === "text" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="written_answer">Expected answer</Label>
          <Input
            id="written_answer"
            value={writtenAnswer}
            onChange={(event) => setWrittenAnswer(event.target.value)}
            className="h-12 text-base md:text-base"
          />
          <p className="text-sm text-muted-foreground">
            Optional. Written answers still go to the review queue.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? (
        <p className="text-sm text-primary" role="status">
          {success}
        </p>
      ) : null}

      <Button type="submit" className="h-12 px-5 text-base" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save question"}
      </Button>
    </form>
  );
}
