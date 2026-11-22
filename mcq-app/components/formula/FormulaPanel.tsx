"use client";

import { useEffect, useRef } from "react";

import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locale";
import {
  classroomLayouts,
  classroomShortcuts,
  mathliveLocale,
  type KeyboardLayout,
} from "@/lib/mathKeyboard";

import "mathlive/fonts.css";

type FormulaPanelProps = {
  initialLatex: string;
  onLatex: (latex: string) => void;
  locale: Locale;
};

function tabLabels(locale: Locale) {
  return {
    numeric: t("shell.copy.keyboard123", locale),
    functions: t("shell.copy.keyboardFx", locale),
    letters: t("shell.copy.keyboardAbc", locale),
    symbols: t("shell.copy.keyboardSymbols", locale),
  };
}

export default function FormulaPanel({ initialLatex, onLatex, locale }: FormulaPanelProps) {
  const host = useRef<HTMLDivElement>(null);
  const onLatexRef = useRef(onLatex);
  const localeRef = useRef(locale);
  onLatexRef.current = onLatex;
  localeRef.current = locale;

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const { MathfieldElement } = await import("mathlive");
      if (disposed || !parent) return;

      MathfieldElement.fontsDirectory = null;
      MathfieldElement.soundsDirectory = null;
      const supported = Object.keys(MathfieldElement.strings ?? {});
      const applyLocale = (active: Locale) => {
        MathfieldElement.locale = mathliveLocale(active, supported);
        const keyboard = window.mathVirtualKeyboard;
        if (!keyboard) return;
        keyboard.layouts = classroomLayouts(tabLabels(active)) as KeyboardLayout[];
        keyboard.editToolbar = "none";
      };
      applyLocale(localeRef.current);

      const field = new MathfieldElement();
      field.style.display = "block";
      field.style.width = "100%";
      field.style.minHeight = "3rem";
      field.style.fontSize = "16px";
      field.style.padding = "0.5rem 0.75rem";
      field.style.background = "transparent";
      field.style.color = "inherit";
      field.style.touchAction = "manipulation";
      parent.replaceChildren(field);
      field.mathVirtualKeyboardPolicy = "auto";
      field.defaultMode = "inline-math";
      field.smartFence = true;
      field.value = initialLatex;
      field.inlineShortcuts = classroomShortcuts({ ...field.inlineShortcuts });

      const publish = () => onLatexRef.current(field.value);
      field.addEventListener("input", publish);
      field.focus();
      cleanup = () => {
        field.removeEventListener("input", publish);
        field.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
    // The field is created once per open. Locale updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import("mathlive").then(({ MathfieldElement }) => {
      if (cancelled) return;
      const supported = Object.keys(MathfieldElement.strings ?? {});
      MathfieldElement.locale = mathliveLocale(locale, supported);
      const keyboard = window.mathVirtualKeyboard;
      if (!keyboard) return;
      keyboard.layouts = classroomLayouts(tabLabels(locale)) as KeyboardLayout[];
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return (
    <div
      ref={host}
      className="min-h-16 w-full rounded-md border border-border bg-background text-base text-foreground"
    />
  );
}
