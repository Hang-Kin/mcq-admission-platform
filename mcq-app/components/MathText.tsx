import { cn } from "@/lib/utils";

import { isMathQuestion, parseMathText } from "./mathText";

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

export function MathText({ text, subject, category, className }: MathTextProps) {
  if (!isMathQuestion({ subject, category })) {
    if (!className) return text;
    return <span className={className}>{text}</span>;
  }

  const pieces = parseMathText(text);
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
