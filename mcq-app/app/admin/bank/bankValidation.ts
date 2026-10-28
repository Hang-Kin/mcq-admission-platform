import { fractionCheck } from "./fraction";
import {
  isRealTopic,
  parseSubject,
  validateTopicName,
  type SubjectId,
} from "./subjects";

export const MAX_CHOICES = 6;

const NUMBER_ANSWER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

export type BankQuestionPayload = {
  question_text: string;
  category: string;
  subject: SubjectId;
  type: "radio" | "numeric" | "fraction" | "text";
  options: string[] | null;
  correct_answer: string | null;
};

export type BankQuestionInput = {
  subject: string;
  category: string;
  /** Older rows may still use the subject word as their category. */
  allowLegacyCategory?: boolean;
  questionText: string;
  kind: string;
  options: string[] | null;
  correctAnswer: string;
  fractionA: string;
  fractionB: string;
};

export function answerKindLabel(type: string): string {
  if (type === "radio") return "Choice";
  if (type === "numeric") return "Number";
  if (type === "fraction") return "Fraction";
  if (type === "text") return "Written answer";
  return "Answer";
}

export function validateBankQuestion(
  input: BankQuestionInput,
): { ok: true; payload: BankQuestionPayload } | { ok: false; error: string } {
  const subject = parseSubject(input.subject);
  if (!subject) return { ok: false, error: "Choose Math or Chinese." };

  const question_text = input.questionText.trim();
  if (!question_text) return { ok: false, error: "Enter the question." };

  const categoryResult = resolveCategory(
    input.category,
    input.allowLegacyCategory === true,
  );
  if (!categoryResult.ok) return categoryResult;

  const kind = input.kind.trim();
  const category = categoryResult.name;

  if (kind === "choice") {
    const options = (input.options ?? []).map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) {
      return { ok: false, error: "Enter at least two choices." };
    }
    if (options.length > MAX_CHOICES) {
      return { ok: false, error: `Use at most ${MAX_CHOICES} choices.` };
    }
    if (new Set(options).size !== options.length) {
      return { ok: false, error: "Each choice must be different." };
    }
    const correct_answer = input.correctAnswer.trim();
    if (!correct_answer || !options.includes(correct_answer)) {
      return { ok: false, error: "Mark the correct choice." };
    }
    return {
      ok: true,
      payload: {
        question_text,
        category,
        subject,
        type: "radio",
        options,
        correct_answer,
      },
    };
  }

  if (kind === "number") {
    const correct_answer = input.correctAnswer.trim();
    if (!NUMBER_ANSWER.test(correct_answer)) {
      return { ok: false, error: "Enter the correct number." };
    }
    return {
      ok: true,
      payload: {
        question_text,
        category,
        subject,
        type: "numeric",
        options: null,
        correct_answer,
      },
    };
  }

  if (kind === "fraction") {
    const check = fractionCheck(input.fractionA, input.fractionB);
    if (check.kind !== "simplified") {
      return { ok: false, error: check.message };
    }
    return {
      ok: true,
      payload: {
        question_text,
        category,
        subject,
        type: "fraction",
        options: null,
        correct_answer: check.canonical,
      },
    };
  }

  if (kind === "text") {
    const correct_answer = input.correctAnswer.trim();
    return {
      ok: true,
      payload: {
        question_text,
        category,
        subject,
        type: "text",
        options: null,
        correct_answer: correct_answer || null,
      },
    };
  }

  return { ok: false, error: "Choose choice, number, or fraction." };
}

function resolveCategory(
  category: string,
  allowLegacyCategory: boolean,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = category.trim();
  if (allowLegacyCategory && name && !isRealTopic(name)) {
    return { ok: true, name };
  }
  return validateTopicName(name);
}
