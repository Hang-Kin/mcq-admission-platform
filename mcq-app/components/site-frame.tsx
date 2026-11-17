import type { ReactNode } from "react";

import { Nav } from "@/components/nav";
import { PreferencesProvider } from "@/components/nav-preferences";
import { StaffNavGate } from "@/components/staff-nav-gate";
import { staffNavVisible } from "@/components/staff-nav";
import type { Preferences } from "@/lib/preferences/preferences";
import { readServerPreferences } from "@/lib/preferences/server";

function NavChrome({ initial }: { initial: Preferences }) {
  return (
    <PreferencesProvider initial={initial}>
      <Nav />
    </PreferencesProvider>
  );
}

export async function SiteFrame({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const showNav = staffNavVisible(pathname);
  const initial = showNav ? await readServerPreferences() : null;
  return (
    <StaffNavGate
      pathname={pathname}
      nav={showNav && initial ? <NavChrome initial={initial} /> : null}
    >
      {children}
    </StaffNavGate>
  );
}
