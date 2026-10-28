"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

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
  { href: "/admin/exams/new", label: "Create exam" },
  { href: "/admin/exams", label: "Exam list" },
  { href: "/admin/questions", label: "Older question list" },
  { href: "/admin/questions/import", label: "Import questions" },
  { href: "/admin/advanced", label: "Advanced" },
  { href: "/protected", label: "Account details" },
] as const;

export function AccountMenu({
  email,
  layout,
}: {
  email: string;
  layout: "menu" | "list";
}) {
  const router = useRouter();
  const label = email.trim() || "Account";

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (layout === "list") {
    return (
      <div className="space-y-1">
        <p className="truncate px-2 py-2 text-sm text-primary-foreground/80">{label}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="block w-full rounded-md px-2 py-2 text-left text-sm text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          Sign out
        </button>
        <p className="px-2 pb-1 pt-3 text-sm font-medium text-primary-foreground">
          Admin tools
        </p>
        {adminToolLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-md px-4 py-2 text-sm text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground hover:no-underline"
          >
            {link.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex max-w-[8rem] items-center truncate rounded-md px-2 py-1 text-sm text-primary-foreground/80 outline-none hover:text-primary-foreground focus-visible:ring-1 focus-visible:ring-primary-foreground lg:max-w-[14rem]"
        aria-label={`Account menu for ${label}`}
      >
        <span className="truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
        >
          Sign out
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Admin tools</DropdownMenuLabel>
        {adminToolLinks.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <Link href={link.href}>{link.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
