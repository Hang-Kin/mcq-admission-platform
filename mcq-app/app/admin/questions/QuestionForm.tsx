"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_OPTIONS = 6;
const QUESTION_TYPES = ["radio", "numeric", "text"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export type QuestionFormValues = {
  question_text: string;
  category: string;
  type: string;
  options: unknown;
  correct_answer: string | null;
};

type QuestionFormProps = {
  question?: QuestionFormValues;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
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

function isQuestionType(value: string): value is QuestionType {
  return QUESTION_TYPES.includes(value as QuestionType);
}

function initialCorrectOptionIndex(
  options: string[],
  correctAnswer: string | null | undefined,
) {
  if (!correctAnswer) return 0;
  const index = options.findIndex((option) => option === correctAnswer);
  return index >= 0 ? index : 0;
}

export function QuestionForm({ question, action }: QuestionFormProps) {
  const [questionText, setQuestionText] = useState(question?.question_text ?? "");
  const [category, setCategory] = useState(question?.category ?? "");
  const [type, setType] = useState<QuestionType>(
    question?.type && isQuestionType(question.type) ? question.type : "radio",
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedText = questionText.trim();
    const trimmedCategory = category.trim();

    if (!trimmedText || !trimmedCategory || !type) {
      setError("Please fill in all required fields.");
      return;
    }

    if (type === "radio") {
      const filledOptions = options.map((option) => option.trim()).filter(Boolean);
      if (filledOptions.length < 2) {
        setError("Please provide at least two options.");
        return;
      }
      if (!options[correctOptionIndex]?.trim()) {
        setError("Please select a correct option.");
        return;
      }
    } else if (!correctAnswer.trim()) {
      setError("Please provide a correct answer.");
      return;
    }

    const formData = new FormData();
    formData.set("question_text", trimmedText);
    formData.set("category", trimmedCategory);
    formData.set("type", type);

    if (type === "radio") {
      formData.set(
        "options",
        JSON.stringify(options.map((option) => option.trim()).filter(Boolean)),
      );
      formData.set("correct_answer", options[correctOptionIndex].trim());
    } else {
      formData.set("options", "");
      formData.set("correct_answer", correctAnswer.trim());
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
        <Label htmlFor="question_text">Question</Label>
        <textarea
          id="question_text"
          name="question_text"
          required
          value={questionText}
          onChange={(event) => setQuestionText(event.target.value)}
          className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
        />
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
          <option value="radio">radio</option>
          <option value="numeric">numeric</option>
          <option value="text">text</option>
        </select>
      </div>

      {type === "radio" ? (
        <div className="flex flex-col gap-2">
          <Label>Options</Label>
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
          <Label htmlFor="correct_answer">Correct answer</Label>
          <Input
            id="correct_answer"
            name="correct_answer"
            required
            value={correctAnswer}
            onChange={(event) => setCorrectAnswer(event.target.value)}
          />
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
