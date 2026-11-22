"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ClipboardEvent } from "react";

import { T } from "@/app/admin/T";
import { useLiveLocale } from "@/app/admin/usePhrase";
import { MathText } from "@/components/MathText";
import { Button } from "@/components/ui/button";
import { applyFormula, formulaAtCursor, pasteNeedsFormulaWarning } from "@/lib/formulaEdit";

const FormulaPanel = dynamic(() => import("./FormulaPanel"), { ssr: false });

type MathQuestionFieldProps = {
  id: string;
  name?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  className: string;
  subject?: string | null;
  category?: string | null;
};

export function MathQuestionField({
  id,
  name,
  required,
  value,
  onChange,
  className,
  subject,
  category,
}: MathQuestionFieldProps) {
  const locale = useLiveLocale();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pasteWarning, setPasteWarning] = useState(false);

  const editing =
    selection.start === selection.end && formulaAtCursor(value, selection.start) !== null;

  function remember() {
    const area = areaRef.current;
    if (!area) return;
    setSelection({
      start: area.selectionStart ?? 0,
      end: area.selectionEnd ?? 0,
    });
  }

  function openPanel() {
    const area = areaRef.current;
    const start = area?.selectionStart ?? selection.start;
    const end = area?.selectionEnd ?? selection.end;
    setSelection({ start, end });
    const found = start === end ? formulaAtCursor(value, start) : null;
    setDraft(found?.latex ?? "");
    setOpen(true);
  }

  function commit() {
    const next = applyFormula(value, selection.start, selection.end, draft);
    onChange(next.text);
    setOpen(false);
    setSelection({ start: next.cursor, end: next.cursor });
    requestAnimationFrame(() => {
      const area = areaRef.current;
      if (!area) return;
      area.focus();
      area.setSelectionRange(next.cursor, next.cursor);
    });
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    setPasteWarning(pasteNeedsFormulaWarning(event.clipboardData.getData("text")));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 px-4 text-base"
          onClick={openPanel}
        >
          {editing ? <T id="shell.copy.editFormula" /> : <T id="shell.copy.insertFormula" />}
        </Button>
      </div>
      <textarea
        ref={areaRef}
        id={id}
        name={name}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onSelect={remember}
        onKeyUp={remember}
        onClick={remember}
        onBlur={remember}
        onPaste={onPaste}
        className={className}
      />
      {pasteWarning ? (
        <p className="text-sm text-muted-foreground" role="status">
          <T id="shell.copy.pasteSymbols" />
        </p>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-3">
          <FormulaPanel initialLatex={draft} onLatex={setDraft} locale={locale} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-12 px-4 text-base" onClick={commit}>
              <T id="shell.copy.insert" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 px-4 text-base"
              onClick={() => setOpen(false)}
            >
              <T id="shell.copy.cancel" />
            </Button>
          </div>
        </div>
      ) : null}
      <div className="rounded-md border border-border bg-background px-3 py-3">
        <p className="mb-2 text-sm text-muted-foreground">
          <T id="shell.copy.formulaPreview" />
        </p>
        <div className="text-base leading-relaxed">
          <MathText text={value} subject={subject} category={category} />
        </div>
      </div>
    </div>
  );
}
