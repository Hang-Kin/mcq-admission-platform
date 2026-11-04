"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";

import { ShellText } from "@/components/nav-shell-text";
import { isHrefActive, isNavActive, sectionLink } from "@/components/nav-links";
import type { NavSection } from "@/components/nav-menu";
import { cn } from "@/lib/utils";

import { canHover, HOVER_CLOSE_MS, isHoverPointer } from "./nav-hover";

const triggerClass =
  "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground";

const headingClass =
  "block rounded-md px-3 py-1.5 text-sm font-bold text-popover-foreground";

const headingLinkClass = cn(
  headingClass,
  "hover:bg-menu-highlight hover:text-menu-highlight-foreground hover:no-underline focus-visible:bg-menu-highlight focus-visible:text-menu-highlight-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

const itemClass =
  "block rounded-md py-2.5 pl-6 pr-3 text-base text-popover-foreground hover:bg-menu-highlight hover:text-menu-highlight-foreground hover:no-underline focus-visible:bg-menu-highlight focus-visible:text-menu-highlight-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NavSectionMenu({
  section,
  pathname,
  hash,
  open,
  align,
  onOpen,
  onClose,
}: {
  section: NavSection;
  pathname: string;
  hash: string;
  open: boolean;
  align: "left" | "right";
  onOpen: () => void;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const closeTimer = useRef<number | null>(null);
  const pointerType = useRef("mouse");
  const panelId = `nav-panel-${section.id}`;
  const active = isNavActive(pathname, sectionLink(section));

  useEffect(() => {
    return () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function clearTimer() {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
  }

  function hoverOpen() {
    clearTimer();
    onOpen();
  }

  function hoverClose() {
    if (!isHoverPointer(pointerType.current)) return;
    clearTimer();
    closeTimer.current = window.setTimeout(() => {
      if (wrapRef.current?.matches(":hover")) return;
      onClose();
    }, HOVER_CLOSE_MS);
  }

  function onTriggerClick(event: MouseEvent<HTMLAnchorElement>) {
    if (canHover()) return;
    if (open) return;
    event.preventDefault();
    onOpen();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const links = [
      triggerRef.current,
      ...Array.from(wrapRef.current?.querySelectorAll<HTMLAnchorElement>("[data-menu-link]") ?? []),
    ].filter((link): link is HTMLAnchorElement => link != null);
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onOpen();
      const next = links[Math.min(index < 0 ? 0 : index + 1, links.length - 1)];
      requestAnimationFrame(() => next?.focus());
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = links[Math.max(index <= 0 ? 0 : index - 1, 0)];
      next?.focus();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      onPointerEnter={(event) => {
        pointerType.current = event.pointerType || "mouse";
      }}
      onMouseEnter={() => {
        if (!isHoverPointer(pointerType.current)) return;
        hoverOpen();
      }}
      onMouseLeave={hoverClose}
      onFocus={() => onOpen()}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <Link
        ref={triggerRef}
        href={section.href}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        aria-current={active ? "page" : undefined}
        className={cn(triggerClass, active && "font-semibold underline underline-offset-4")}
        onClick={onTriggerClick}
      >
        <ShellText id={section.labelKey} />
      </Link>
      {open ? (
        <div className={cn("absolute top-full z-50 pt-2", align === "right" ? "right-0" : "left-0")}>
          <div
            id={panelId}
            className="nav-menu w-[min(22rem,calc(100vw-2rem))] rounded-md border border-menu-border bg-popover p-3 text-popover-foreground"
          >
            {section.groups.map((group, index) => (
              <div
                key={group.id}
                className={index > 0 ? "mt-3 border-t border-menu-border pt-3" : undefined}
              >
                {group.href ? (
                  <Link
                    href={group.href}
                    data-menu-link=""
                    aria-current={isHrefActive(pathname, group.href, hash) ? "page" : undefined}
                    className={headingLinkClass}
                  >
                    <ShellText id={group.labelKey} />
                  </Link>
                ) : (
                  <p className={headingClass}>
                    <ShellText id={group.labelKey} />
                  </p>
                )}
                {group.items.length > 0 ? (
                  <ul className="mt-2 border-t border-menu-border pt-2">
                    {group.items.map((item) => {
                      const current = isHrefActive(pathname, item.href, hash);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            data-menu-link=""
                            aria-current={current ? "page" : undefined}
                            className={cn(itemClass, current && "bg-menu-highlight font-medium text-menu-highlight-foreground")}
                          >
                            <ShellText id={item.labelKey} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
