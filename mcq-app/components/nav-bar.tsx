"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import { ShellText } from "@/components/nav-shell-text";
import { isHrefActive, isNavActive, sectionLink } from "@/components/nav-links";
import type { NavSection } from "@/components/nav-menu";
import { cn } from "@/lib/utils";

import { NavSectionMenu } from "./nav-section-menu";
import { SettingsPanel } from "./settings-panel";

const mobileLinkClass =
  "block rounded-md px-2 py-3 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:no-underline";

export function NavBar({
  sections,
  session,
  mobileSession,
}: {
  sections: readonly NavSection[];
  session?: ReactNode;
  mobileSession?: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [hash, setHash] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsCloseToken, setSettingsCloseToken] = useState(0);

  useEffect(() => {
    setOpenId(null);
    setMobileOpen(false);
    setSettingsCloseToken((token) => token + 1);
  }, [pathname]);

  useEffect(() => {
    function syncHash() {
      setHash(window.location.hash);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen && !openId) return;
    function onPointer(event: PointerEvent) {
      const header = document.getElementById("site-header");
      if (header?.contains(event.target as Node)) return;
      setOpenId(null);
      setMobileOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenId(null);
      setMobileOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen, openId]);

  function openSection(id: string) {
    setOpenId(id);
    setMobileOpen(false);
    setSettingsCloseToken((token) => token + 1);
  }

  return (
    <header
      id="site-header"
      className="sticky top-0 z-40 border-b border-primary bg-primary text-primary-foreground"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2 sm:px-8">
        <Link
          href="/admin"
          className="inline-flex min-h-11 shrink-0 items-center text-lg font-semibold tracking-tight text-primary-foreground hover:no-underline"
        >
          <ShellText id="shell.brand" />
        </Link>

        <nav
          className="hidden min-w-0 grow flex-wrap items-center gap-1 md:flex"
          aria-labelledby="primary-nav-label"
        >
          <span id="primary-nav-label" className="sr-only">
            <ShellText id="shell.action.primary" />
          </span>
          {sections.map((section, index) => (
            <NavSectionMenu
              key={section.id}
              section={section}
              pathname={pathname}
              hash={hash}
              open={openId === section.id}
              align={index >= sections.length - 2 ? "right" : "left"}
              onOpen={() => openSection(section.id)}
              onClose={() => setOpenId((current) => (current === section.id ? null : current))}
            />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden md:flex">{session}</div>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md text-primary-foreground md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => {
              setMobileOpen((current) => !current);
              setOpenId(null);
              setSettingsCloseToken((token) => token + 1);
            }}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            <span className="sr-only">
              <ShellText id={mobileOpen ? "shell.action.closeMenu" : "shell.action.openMenu"} />
            </span>
          </button>
          <SettingsPanel
            closeToken={settingsCloseToken}
            onOpen={() => {
              setOpenId(null);
              setMobileOpen(false);
            }}
          />
        </div>
      </div>

      {mobileOpen ? (
        <div id="mobile-nav" className="border-t border-primary-foreground/20 px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-4" aria-labelledby="mobile-nav-label">
            <span id="mobile-nav-label" className="sr-only">
              <ShellText id="shell.action.primary" />
            </span>
            {sections.map((section) => {
              const active = isNavActive(pathname, sectionLink(section));
              return (
                <div key={section.id}>
                  <Link
                    href={section.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(mobileLinkClass, active && "font-semibold underline underline-offset-4")}
                  >
                    <ShellText id={section.labelKey} />
                  </Link>
                  <div className="mt-1 space-y-3 pl-3">
                    {section.groups.map((group) => (
                      <div key={group.id}>
                        {group.href ? (
                          <Link href={group.href} className={cn(mobileLinkClass, "font-medium")}>
                            <ShellText id={group.labelKey} />
                          </Link>
                        ) : (
                          <p className="px-2 py-1 text-sm font-semibold text-primary-foreground">
                            <ShellText id={group.labelKey} />
                          </p>
                        )}
                        <ul>
                          {group.items.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                aria-current={
                                  isHrefActive(pathname, item.href, hash) ? "page" : undefined
                                }
                                className={mobileLinkClass}
                              >
                                <ShellText id={item.labelKey} />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          {mobileSession ? (
            <div className="mt-4 border-t border-primary-foreground/20 pt-4">{mobileSession}</div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
