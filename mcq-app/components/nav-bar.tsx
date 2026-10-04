"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

export type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
};

function isActive(pathname: string, link: NavLink) {
  if (link.exact || link.href === "/") {
    return pathname === link.href;
  }
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function NavBar({
  links,
  email,
  showLogout = false,
}: {
  links: NavLink[];
  email: string | null;
  showLogout?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-primary bg-primary text-primary-foreground">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="shrink-0 text-base font-semibold tracking-tight text-primary-foreground"
        >
          MCQ Admission
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {links.map((link) => {
            const active = isActive(pathname, link);
            return (
              <Link
                key={link.href + link.label}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-sm text-primary-foreground/80 hover:text-primary-foreground hover:no-underline",
                  active &&
                    "font-medium text-primary-foreground underline underline-offset-4",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {email ? (
            <span className="max-w-[16rem] truncate text-sm text-primary-foreground/80">
              {email}
            </span>
          ) : null}
          {showLogout ? (
            <LogoutButton className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary" />
          ) : null}
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-primary-foreground md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-primary-foreground/20 px-5 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Primary">
            {links.map((link) => {
              const active = isActive(pathname, link);
              return (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-2 py-2 text-sm text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground hover:no-underline",
                    active && "font-medium text-primary-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {email || showLogout ? (
            <div className="mt-4 flex flex-col items-start gap-3 border-t border-primary-foreground/20 pt-4">
              {email ? (
                <span className="px-2 text-sm text-primary-foreground/80">
                  {email}
                </span>
              ) : null}
              {showLogout ? (
                <LogoutButton className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary" />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
