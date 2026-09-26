"use client";

import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { publicQuestionImagePath, questionImageError } from "./questionImages";
import {
  MAX_OPTIONS,
  isQuestionType,
  validateQuestionRow,
  type QuestionType,
} from "./questionValidation";

export type { QuestionType };

export type QuestionFormValues = {
  question_text: string;
  category: string;
  type: string;
  options: unknown;
  correct_answer: string | null;
  question_set: string | null;
  image_url: string | null;
};

type QuestionFormProps = {
  question?: QuestionFormValues;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  questionSetNames: string[];
  initialQuestionSet?: string;
};

function normalizeOptions(options: unknown): string[] {
  const values = Array.isArray(options)
    ? options.map((value) => String(value))
    : [];
  while (values.length < 2) {
    values.push("");
  }
  return values.slice(0, MAX_OPTIONS);
}

function initialCorrectOptionIndex(
  options: string[],
  correctAnswer: string | null | undefined,
) {
  if (!correctAnswer) return 0;
  const index = options.findIndex((option) => option === correctAnswer);
  return index >= 0 ? index : 0;
}

export function QuestionForm({
  question,
  action,
  questionSetNames,
  initialQuestionSet = "",
}: QuestionFormProps) {
  const listId = "question-set-names";
  const imageRef = useRef<HTMLInputElement>(null);
  const allowNumeric = question?.type === "numeric";
  const typeChoices: QuestionType[] = allowNumeric
    ? ["radio", "text", "numeric"]
    : ["radio", "text"];
  const [questionText, setQuestionText] = useState(question?.question_text ?? "");
  const [category, setCategory] = useState(question?.category ?? "");
  const [questionSet, setQuestionSet] = useState(
    question?.question_set ?? initialQuestionSet,
  );
  const [type, setType] = useState<QuestionType>(
    question?.type && isQuestionType(question.type) && typeChoices.includes(question.type)
      ? question.type
      : "radio",
  );
  const [options, setOptions] = useState<string[]>(() =>
    normalizeOptions(question?.options),
  );
  const [correctOptionIndex, setCorrectOptionIndex] = useState(() =>
    initialCorrectOptionIndex(
      normalizeOptions(question?.options),
      question?.correct_answer,
    ),
  );
  const [correctAnswer, setCorrectAnswer] = useState(
    question?.correct_answer ?? "",
  );
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const existingImage =
    question?.image_url && publicQuestionImagePath(question.image_url)
      ? question.image_url
      : null;

  function updateOption(index: number, value: string) {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    );
  }

  function addOption() {
    setOptions((current) =>
      current.length >= MAX_OPTIONS ? current : [...current, ""],
    );
  }

  function removeOption(index: number) {
    setOptions((current) =>
      current.length <= 2 ? current : current.filter((_, optionIndex) => optionIndex !== index),
    );
    setCorrectOptionIndex((current) => {
      if (current === index) return 0;
      if (current > index) return current - 1;
      return current;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const image = imageRef.current?.files?.[0];
    if (image && image.size > 0) {
      const imageProblem = questionImageError(image);
      if (imageProblem) {
        setError(imageProblem);
        return;
      }
    }

    const validated = validateQuestionRow({
      question_text: questionText,
      category,
      type,
      options: type === "radio" ? options : null,
      correct_answer:
        type === "radio" ? (options[correctOptionIndex] ?? "") : correctAnswer,
      question_set: questionSet,
      requireQuestionSet: true,
    });

    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    const formData = new FormData();
    formData.set("question_text", validated.payload.question_text);
    formData.set("category", validated.payload.category);
    formData.set("type", validated.payload.type);
    formData.set("question_set", validated.payload.question_set ?? "");

    if (validated.payload.type === "radio") {
      formData.set("options", JSON.stringify(validated.payload.options ?? []));
      formData.set("correct_answer", validated.payload.correct_answer ?? "");
    } else {
      formData.set("options", "");
      formData.set("correct_answer", validated.payload.correct_answer ?? "");
    }

    if (image && image.size > 0) {
      formData.set("image", image);
    }
    if (removeImage) {
      formData.set("remove_image", "1");
    }

    setIsSubmitting(true);
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="question_set">Question set</Label>
        <Input
          id="question_set"
          name="question_set"
          list={listId}
          required
          value={questionSet}
          onChange={(event) => setQuestionSet(event.target.value)}
          placeholder="Type a new set name or pick an existing one"
        />
        <datalist id={listId}>
          {questionSetNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <p className="text-sm text-muted-foreground">
          A set is the shared question_set tag. Type a new name to create one.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="question_text">Question</Label>
        <textarea
          id="question_text"
          name="question_text"
          required
          value={questionText}
          onChange={(event) => setQuestionText(event.target.value)}
          className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
        />
        <p className="text-sm text-muted-foreground">
          Required even when you attach an image. Use it as the instruction or caption.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="image">Image</Label>
        {existingImage && !removeImage ? (
          // Public bucket URL. Loaded directly so it does not need a Next image host.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={existingImage}
            alt=""
            className="max-h-48 w-full rounded-md border object-contain"
          />
        ) : null}
        <input
          ref={imageRef}
          id="image"
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="text-sm"
        />
        {existingImage ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={removeImage}
              onChange={(event) => setRemoveImage(event.target.checked)}
            />
            Remove current image
          </label>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          name="category"
          required
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          required
          value={type}
          onChange={(event) => setType(event.target.value as QuestionType)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
        >
          {typeChoices.map((choice) => (
            <option key={choice} value={choice}>
              {choice === "text" ? "text box" : choice}
            </option>
          ))}
        </select>
      </div>

      {type === "radio" ? (
        <div className="flex flex-col gap-2">
          <Label>Options</Label>
          <p className="text-sm text-muted-foreground">
            Mark exactly one option as correct.
          </p>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct_option"
                checked={correctOptionIndex === index}
                onChange={() => setCorrectOptionIndex(index)}
                aria-label={`Mark option ${index + 1} as correct`}
              />
              <Input
                value={option}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
              />
              <Button
                type="button"
                variant="outline"
                disabled={options.length <= 2}
                onClick={() => removeOption(index)}
              >
                Remove
              </Button>
            </div>
          ))}
          {options.length < MAX_OPTIONS ? (
            <Button type="button" variant="outline" onClick={addOption}>
              Add option
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="correct_answer">
            {type === "text" ? "Expected answer" : "Correct answer"}
          </Label>
          <Input
            id="correct_answer"
            name="correct_answer"
            required={type !== "text"}
            value={correctAnswer}
            onChange={(event) => setCorrectAnswer(event.target.value)}
          />
          {type === "text" ? (
            <p className="text-sm text-muted-foreground">
              Optional. Text answers always go to the manual review queue, including
              when this is left blank.
            </p>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
