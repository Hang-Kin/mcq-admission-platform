"use client";

import katex from "katex";

import { cn } from "@/lib/utils";
import { latexToPlain, splitMathText } from "@/lib/mathText";

import { mathDisplayPieces } from "./mathText";

import "katex/dist/katex.min.css";

type MathTextProps = {
  text: string;
  subject?: string | null;
  category?: string | null;
  className?: string;
};

function StackedFraction({
  numerator,
  denominator,
}: {
  numerator: string;
  denominator: string;
}) {
  return (
    <span className="mx-[0.15em] inline-grid align-middle text-center text-[0.8em] tabular-nums leading-none">
      <span className="px-[0.28em] pb-[0.08em]">{numerator}</span>
      <span className="h-px w-full bg-current" />
      <span className="px-[0.28em] pt-[0.08em]">{denominator}</span>
    </span>
  );
}

function renderLatex(latex: string): string | null {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      trust: false,
      displayMode: false,
      strict: "ignore",
    });
  } catch {
    return null;
  }
}

function LegacyMath({
  text,
  subject,
  category,
  className,
}: MathTextProps) {
  const pieces = mathDisplayPieces(text, { subject, category });
  if (!pieces) {
    if (!className) return text;
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="select-none">
        {pieces.map((piece, index) => {
          if (piece.kind === "text") {
            return <span key={index}>{piece.text}</span>;
          }
          if (piece.kind === "mixed") {
            return (
              <span key={index} className="whitespace-nowrap">
                {piece.whole}
                <StackedFraction
                  numerator={piece.numerator}
                  denominator={piece.denominator}
                />
              </span>
            );
          }
          return (
            <StackedFraction
              key={index}
              numerator={piece.numerator}
              denominator={piece.denominator}
            />
          );
        })}
      </span>
    </span>
  );
}

export function MathText({ text, subject, category, className }: MathTextProps) {
  const segments = splitMathText(text);
  const hasMath = segments.some((segment) => segment.type === "math");
  if (!hasMath) {
    return (
      <LegacyMath
        text={text}
        subject={subject}
        category={category}
        className={className}
      />
    );
  }

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={index}>{segment.value}</span>;
        }
        const html = renderLatex(segment.value);
        if (html === null) {
          return <span key={index}>{latexToPlain(segment.value)}</span>;
        }
        // KaTeX HTML only. The question string itself is never inserted as HTML.
        return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </span>
  );
}
