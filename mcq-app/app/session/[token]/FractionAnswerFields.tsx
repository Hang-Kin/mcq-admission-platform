import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { examLabels } from "./labels.js";

type FractionAnswerFieldsProps = {
  numerator: string;
  denominator: string;
  message: string | null;
  disabled?: boolean;
  onNumeratorChange: (value: string) => void;
  onDenominatorChange: (value: string) => void;
};

export function FractionAnswerFields({
  numerator,
  denominator,
  message,
  disabled = false,
  onNumeratorChange,
  onDenominatorChange,
}: FractionAnswerFieldsProps) {
  const messageId = "fraction-answer-message";
  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-medium text-foreground">
        {examLabels.fractionLegend}
      </legend>
      <div className="flex w-full max-w-md items-end gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="fraction-numerator" className="text-base">
            {examLabels.fractionNumerator}
          </Label>
          <Input
            id="fraction-numerator"
            inputMode="text"
            autoComplete="off"
            value={numerator}
            disabled={disabled}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? messageId : undefined}
            className="h-11 min-h-11 text-base md:text-base"
            onChange={(event) => onNumeratorChange(event.target.value)}
          />
        </div>
        <span className="pb-3 text-base text-foreground" aria-hidden="true">
          /
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="fraction-denominator" className="text-base">
            {examLabels.fractionDenominator}
          </Label>
          <Input
            id="fraction-denominator"
            inputMode="text"
            autoComplete="off"
            value={denominator}
            disabled={disabled}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? messageId : undefined}
            className="h-11 min-h-11 text-base md:text-base"
            onChange={(event) => onDenominatorChange(event.target.value)}
          />
        </div>
      </div>
      {message ? (
        <p id={messageId} className="break-words text-base text-muted-foreground">
          {message}
        </p>
      ) : null}
    </fieldset>
  );
}
