"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Settings, X } from "lucide-react";

import { ShellText } from "@/components/nav-shell-text";
import { usePreferences } from "@/components/nav-preferences";
import { Button } from "@/components/ui/button";
import { UI_SIZES } from "@/lib/preferences/preferences";
import { cn } from "@/lib/utils";

import { canHover } from "./nav-hover";

const choiceClass = "min-h-11 px-4 text-base";

export function SettingsPanel({
  closeToken,
  onOpen,
}: {
  closeToken: number;
  onOpen: () => void;
}) {
  const prefs = usePreferences();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const skipClick = useRef(false);

  useEffect(() => {
    setOpen(false);
  }, [closeToken]);

  useEffect(() => {
    return () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (prefs.exam) return null;

  function clearTimer() {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
  }

  function show() {
    clearTimer();
    setOpen(true);
    onOpen();
  }

  function hideSoon() {
    if (!canHover()) return;
    clearTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 220);
  }

  const { stored } = prefs;

  return (
    <div
      ref={rootRef}
      className="settings-control relative"
      onMouseEnter={() => show()}
      onMouseLeave={() => {
        if (canHover()) hideSoon();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-medium text-primary-foreground hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
        aria-expanded={open}
        aria-controls="settings-panel"
        onFocus={() => {
          if (canHover() || open) return;
          skipClick.current = true;
          show();
        }}
        onClick={() => {
          if (skipClick.current) {
            skipClick.current = false;
            return;
          }
          if (open) setOpen(false);
          else show();
        }}
      >
        <Settings className="size-5" aria-hidden="true" />
        <ShellText id="shell.settings.title" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-foreground/20"
            onClick={() => setOpen(false)}
          >
            <span className="sr-only">
              <ShellText id="shell.settings.close" />
            </span>
          </button>
          <aside
            id="settings-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="settings-panel-title"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(24rem,100vw)] flex-col overflow-y-auto border-l border-border bg-background p-6 text-foreground shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="settings-panel-title" className="text-xl">
                <ShellText id="shell.settings.title" />
              </h2>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">
                  <ShellText id="shell.settings.close" />
                </span>
              </Button>
            </div>

            <ChoiceGroup
              titleId="settings-language"
              titleKey="shell.settings.language"
              helpKey="shell.settings.languageHelp"
            >
              <Choice
                pressed={stored.locale === "en"}
                onSelect={() => prefs.setLocale("en")}
                labelKey="shell.settings.english"
              />
              <Choice
                pressed={stored.locale === "zh-Hant"}
                onSelect={() => prefs.setLocale("zh-Hant")}
                labelKey="shell.settings.traditionalChinese"
              />
            </ChoiceGroup>

            <ChoiceGroup
              titleId="settings-colour"
              titleKey="shell.settings.colour"
              helpKey="shell.settings.colourHelp"
            >
              <Choice
                pressed={stored.theme === "normal"}
                onSelect={() => prefs.setTheme("normal")}
                labelKey="shell.settings.normal"
              />
              <Choice
                pressed={stored.theme === "contrast"}
                onSelect={() => prefs.setTheme("contrast")}
                labelKey="shell.settings.contrast"
              />
            </ChoiceGroup>

            <ChoiceGroup
              titleId="settings-size"
              titleKey="shell.settings.size"
              helpKey="shell.settings.sizeHelp"
              extra={
                <Button type="button" variant="outline" className={choiceClass} onClick={() => prefs.resetSize()}>
                  <ShellText id="shell.settings.reset" />
                </Button>
              }
            >
              {UI_SIZES.map((size) => (
                <Choice
                  key={size}
                  pressed={stored.size === size}
                  onSelect={() => prefs.setSize(size)}
                  label={`${size}%`}
                />
              ))}
            </ChoiceGroup>

            <p className="mt-6 text-sm text-muted-foreground">
              <ShellText id="shell.settings.saved" />
            </p>
          </aside>
        </>
      ) : null}
    </div>
  );
}

function ChoiceGroup({
  titleId,
  titleKey,
  helpKey,
  children,
  extra,
}: {
  titleId: string;
  titleKey: string;
  helpKey: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <section className="mt-8 space-y-3">
      <h3 id={titleId} className="text-base">
        <ShellText id={titleKey} />
      </h3>
      <p className="text-sm text-muted-foreground">
        <ShellText id={helpKey} />
      </p>
      <div role="radiogroup" aria-labelledby={titleId} className="flex flex-wrap gap-2">
        {children}
      </div>
      {extra ? <div className="flex flex-wrap gap-2">{extra}</div> : null}
    </section>
  );
}

function Choice({
  pressed,
  onSelect,
  labelKey,
  label,
}: {
  pressed: boolean;
  onSelect: () => void;
  labelKey?: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      role="radio"
      aria-checked={pressed}
      variant={pressed ? "default" : "outline"}
      className={cn(choiceClass, pressed && "ring-2 ring-ring")}
      onClick={onSelect}
    >
      {labelKey ? <ShellText id={labelKey} /> : label}
    </Button>
  );
}
