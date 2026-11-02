import { cache, Suspense } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { readSignedInRole } from "@/app/auth/session";
import { AccountMenu } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

import { NavBar } from "./nav-bar";
import { staffNavLinks } from "./nav-links";
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
        <Button asChild size="sm" variant="outline" className={outlineOnPrimary}>
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  if (!session.showLogOut) return null;

  const email = session.email ?? "Signed in";

  return (
    <div className={stacked ? "flex flex-col items-stretch gap-3" : "flex items-center gap-2"}>
      {session.staff ? (
        <AccountMenu email={session.email ?? ""} layout={layout} />
      ) : (
        <span className="max-w-[14rem] truncate text-sm text-primary-foreground/80" title={email}>
          {email}
        </span>
      )}
      <form action={signOut}>
        <Button type="submit" size="sm" variant="outline" className={outlineOnPrimary}>
          Log out
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
      links={staffNavLinks}
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
