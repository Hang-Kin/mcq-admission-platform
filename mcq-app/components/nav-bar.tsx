"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

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

function LinkList({
  links,
  pathname,
  className,
  itemClassName,
}: {
  links: NavLink[];
  pathname: string;
  className: string;
  itemClassName: string;
}) {
  return (
    <nav className={className} aria-label="Primary">
      {links.map((link) => {
        const active = isActive(pathname, link);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(itemClassName, active && "font-medium text-primary-foreground underline underline-offset-4")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function NavBar({
  links,
  session,
  mobileSession,
}: {
  links: NavLink[];
  session?: ReactNode;
  mobileSession?: ReactNode;
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
          className="shrink-0 text-base font-semibold tracking-tight text-primary-foreground hover:no-underline"
        >
          MCQ Admission
        </Link>

        <LinkList
          links={links}
          pathname={pathname}
          className="hidden items-center gap-5 lg:flex"
          itemClassName="text-sm text-primary-foreground/80 hover:text-primary-foreground hover:no-underline"
        />

        <div className="hidden items-center lg:flex">{session}</div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-primary-foreground lg:hidden"
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
          className="border-t border-primary-foreground/20 px-5 py-4 lg:hidden"
        >
          <LinkList
            links={links}
            pathname={pathname}
            className="flex flex-col gap-1"
            itemClassName="rounded-md px-2 py-2 text-sm text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground hover:no-underline"
          />
          {mobileSession ? (
            <div className="mt-4 border-t border-primary-foreground/20 pt-4">
              {mobileSession}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
