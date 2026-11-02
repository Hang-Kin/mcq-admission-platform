import { cache, Suspense } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { readSignedInRole } from "@/app/auth/session";
import { AccountMenu } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

import { ShellText } from "@/components/nav-shell-text";

import { NavBar } from "./nav-bar";
import { staffNavMenu } from "./nav-menu";
import { navbarSession, type NavbarSession } from "./nav-session";

const outlineOnPrimary =
  "border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary";

const loadNavbarSession = cache(async (): Promise<NavbarSession> => {
  if (!hasEnvVars) {
    return navbarSession({ authEnabled: false, user: null, staff: false });
  }

  try {
    const supabase = await createClient();
    const { user, staff } = await readSignedInRole(supabase);
    return navbarSession({ authEnabled: true, user, staff });
  } catch (error) {
    unstable_rethrow(error);
    return navbarSession({ authEnabled: true, user: null, staff: false });
  }
});

function SessionControls({
  session,
  layout,
}: {
  session: NavbarSession;
  layout: "menu" | "list";
}) {
  const stacked = layout === "list";

  if (session.showSignIn) {
    return (
      <div className={stacked ? "flex flex-col gap-2" : "flex gap-2"}>
        <Button asChild variant="outline" className={`${outlineOnPrimary} h-11 px-4 text-base`}>
          <Link href="/auth/login">
            <ShellText id="shell.action.signIn" />
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-11 px-4 text-base">
          <Link href="/auth/sign-up">
            <ShellText id="shell.action.signUp" />
          </Link>
        </Button>
      </div>
    );
  }

  if (!session.showLogOut) return null;

  return (
    <div className={stacked ? "flex flex-col items-stretch gap-3" : "flex items-center gap-2"}>
      {session.staff ? (
        <AccountMenu email={session.email ?? ""} layout={layout} />
      ) : (
        <span
          className="max-w-[14rem] truncate text-base text-primary-foreground"
          title={session.email ?? undefined}
        >
          {session.email ?? <ShellText id="shell.action.signedIn" />}
        </span>
      )}
      <form action={signOut}>
        <Button type="submit" variant="outline" className={`${outlineOnPrimary} h-11 px-4 text-base`}>
          <ShellText id="shell.action.logOut" />
        </Button>
      </form>
    </div>
  );
}

async function SessionSlot({ layout }: { layout: "menu" | "list" }) {
  const session = await loadNavbarSession();
  return <SessionControls session={session} layout={layout} />;
}

export function Nav() {
  return (
    <NavBar
      sections={staffNavMenu}
      session={
        <Suspense fallback={null}>
          <SessionSlot layout="menu" />
        </Suspense>
      }
      mobileSession={
        <Suspense fallback={null}>
          <SessionSlot layout="list" />
        </Suspense>
      }
    />
  );
}
