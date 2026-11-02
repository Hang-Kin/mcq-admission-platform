"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ShellText } from "@/components/nav-shell-text";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const adminToolLinks = [
  { href: "/admin/exams/new", labelKey: "shell.account.createExam" },
  { href: "/admin/exams", labelKey: "shell.account.examList" },
  { href: "/admin/questions", labelKey: "shell.account.olderQuestions" },
  { href: "/admin/questions/import", labelKey: "shell.account.importQuestions" },
  { href: "/admin/advanced", labelKey: "shell.account.advanced" },
  { href: "/protected", labelKey: "shell.account.details" },
] as const;

export function AccountMenu({
  email,
  layout,
}: {
  email: string;
  layout: "menu" | "list";
}) {
  const router = useRouter();
  const label = email.trim();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (layout === "list") {
    return (
      <div className="space-y-1">
        <p className="truncate px-2 py-3 text-base text-primary-foreground">
          {label || <ShellText id="shell.action.signedIn" />}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="block min-h-11 w-full rounded-md px-2 py-2 text-left text-base text-primary-foreground hover:bg-primary-foreground/10"
        >
          <ShellText id="shell.action.signOut" />
        </button>
        <p className="px-2 pb-1 pt-3 text-base font-medium text-primary-foreground">
          <ShellText id="shell.account.tools" />
        </p>
        {adminToolLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block min-h-11 rounded-md px-4 py-2 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:no-underline"
          >
            <ShellText id={link.labelKey} />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex min-h-11 max-w-[10rem] items-center truncate rounded-md px-3 text-base text-primary-foreground outline-none hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-primary-foreground lg:max-w-[16rem]"
      >
        <span className="sr-only">
          <ShellText id="shell.account.menu" />
        </span>
        <span className="truncate">{label || <ShellText id="shell.action.signedIn" />}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {label || <ShellText id="shell.action.signedIn" />}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
        >
          <ShellText id="shell.action.signOut" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          <ShellText id="shell.account.tools" />
        </DropdownMenuLabel>
        {adminToolLinks.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <Link href={link.href}>
              <ShellText id={link.labelKey} />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
