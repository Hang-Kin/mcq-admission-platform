import { Suspense, type ReactNode } from "react";

import { Nav } from "@/components/nav";
import { PreferencesProvider } from "@/components/nav-preferences";
import { StaffNavGate } from "@/components/staff-nav-gate";
import { staffNavVisible } from "@/components/staff-nav";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences/preferences";
import { readServerPreferences } from "@/lib/preferences/server";

function NavChrome({ initial }: { initial: Preferences }) {
  return (
    <PreferencesProvider initial={initial}>
      <Nav />
    </PreferencesProvider>
  );
}

async function SavedNavChrome() {
  const initial = await readServerPreferences();
  return <NavChrome initial={initial} />;
}

export function SiteFrame({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const showNav = staffNavVisible(pathname);
  return (
    <StaffNavGate
      pathname={pathname}
      nav={
        showNav ? (
          <Suspense fallback={<NavChrome initial={DEFAULT_PREFERENCES} />}>
            <SavedNavChrome />
          </Suspense>
        ) : null
      }
    >
      {children}
    </StaffNavGate>
  );
}
