import type { ReactNode } from "react";

import { staffNavVisible } from "./staff-nav";

export function StaffNavGate({
  pathname,
  nav,
  children,
}: {
  pathname: string;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {staffNavVisible(pathname) ? nav ?? null : null}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
        {children}
      </div>
    </div>
  );
}
