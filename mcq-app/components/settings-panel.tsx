"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Settings, X } from "lucide-react";

import { ShellText } from "@/components/nav-shell-text";
import { usePreferences } from "@/components/nav-preferences";
import { Button } from "@/components/ui/button";
import { UI_SIZES, type ThemeName } from "@/lib/preferences/preferences";
import { cn } from "@/lib/utils";

import {
  boxFromRect,
  canHover,
  hoverBridgeBox,
  isHoverPointer,
  reducePanel,
  type Box,
  type PanelEvent,
  type PanelModel,
} from "./nav-hover";

const choiceClass = "min-h-11 px-4 text-base";

const themeChoices: ReadonlyArray<{ id: ThemeName; labelKey: string }> = [
  { id: "normal", labelKey: "shell.settings.normal" },
  { id: "dark", labelKey: "shell.settings.dark" },
  { id: "light-contrast", labelKey: "shell.settings.lightContrast" },
];

export function SettingsPanel({
  closeToken,
  onOpen,
}: {
  closeToken: number;
  onOpen: () => void;
}) {
  const prefs = usePreferences();
  const [open, setOpen] = useState(false);
  const [bridge, setBridge] = useState<Box | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const modelRef = useRef<PanelModel>({ open: false, deadline: null });
  const closeTimer = useRef<number | null>(null);
  const skipClick = useRef(false);
  const restoringFocus = useRef(false);
  const pointerType = useRef("mouse");
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  function clearTimer() {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function commit(next: PanelModel, focusTrigger: boolean) {
    modelRef.current = next;
    setOpen(next.open);
    clearTimer();
    if (next.deadline != null) {
      const due = next.deadline;
      const wait = Math.max(0, due - Date.now());
      closeTimer.current = window.setTimeout(() => {
        if (modelRef.current.deadline !== due) return;
        if (regionRef.current?.matches(":hover")) return;
        const step = reducePanel(modelRef.current, { type: "tick", now: Date.now() });
        commit(step.model, step.focusTrigger);
      }, wait);
    }
    if (focusTrigger) {
      restoringFocus.current = true;
      buttonRef.current?.focus();
      restoringFocus.current = false;
    }
  }

  function dispatch(event: PanelEvent, hoverCapable = canHover()) {
    const wasOpen = modelRef.current.open;
    const step = reducePanel(modelRef.current, event, hoverCapable);
    commit(step.model, step.focusTrigger);
    if (!wasOpen && step.model.open) onOpenRef.current();
  }

  useEffect(() => {
    commit({ open: false, deadline: null }, false);
    // Close when another menu opens or the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeToken]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: "escape" });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // dispatch closes over the latest refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const button = buttonRef.current;
      const panel = panelRef.current;
      if (!button || !panel) {
        setBridge(null);
        return;
      }
      setBridge(hoverBridgeBox(boxFromRect(button.getBoundingClientRect()), boxFromRect(panel.getBoundingClientRect())));
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  if (prefs.exam) return null;

  const { stored } = prefs;

  return (
    <div className="settings-control">
      <div
        ref={regionRef}
        className="relative z-50"
        onPointerEnter={(event) => {
          pointerType.current = event.pointerType || "mouse";
        }}
        onMouseEnter={() => {
          if (!isHoverPointer(pointerType.current)) return;
          dispatch({ type: "pointer-inside" }, true);
        }}
        onMouseLeave={() => {
          if (!isHoverPointer(pointerType.current)) return;
          dispatch({ type: "pointer-outside", now: Date.now() }, true);
        }}
        onBlur={(event) => {
          const next = event.relatedTarget;
          const stillInside = next instanceof Node && (regionRef.current?.contains(next) ?? false);
          dispatch({ type: "focus-out", stillInside });
        }}
      >
        <button
          ref={buttonRef}
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-medium text-primary-foreground hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
          aria-expanded={open}
          aria-controls="settings-panel"
          onFocus={() => {
            if (restoringFocus.current || canHover() || modelRef.current.open) return;
            skipClick.current = true;
            dispatch({ type: "toggle" });
          }}
          onClick={() => {
            if (skipClick.current) {
              skipClick.current = false;
              return;
            }
            dispatch({ type: "toggle" });
          }}
        >
          <Settings className="size-5" aria-hidden="true" />
          <ShellText id="shell.settings.title" />
        </button>
        {open && bridge ? (
          <div aria-hidden="true" className="fixed z-50" style={bridgeStyle(bridge)} />
        ) : null}
        {open ? (
          <aside
            ref={panelRef}
            id="settings-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="settings-panel-title"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(24rem,100vw)] flex-col overflow-y-auto border-l border-border bg-card p-6 text-card-foreground shadow-lg"
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
                  commit({ open: false, deadline: null }, true);
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
              {themeChoices.map((choice) => (
                <Choice
                  key={choice.id}
                  pressed={stored.theme === choice.id}
                  onSelect={() => prefs.setTheme(choice.id)}
                  labelKey={choice.labelKey}
                />
              ))}
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
        ) : null}
      </div>
      {open ? (
        <button
          type="button"
          tabIndex={-1}
          className="fixed inset-0 z-40 cursor-default bg-scrim/30"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => dispatch({ type: "outside-click" })}
        >
          <span className="sr-only">
            <ShellText id="shell.settings.close" />
          </span>
        </button>
      ) : null}
    </div>
  );
}

function bridgeStyle(box: Box): CSSProperties {
  return {
    left: box.left,
    top: box.top,
    width: Math.max(0, box.right - box.left),
    height: Math.max(0, box.bottom - box.top),
  };
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
