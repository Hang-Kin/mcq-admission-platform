import { Suspense } from "react";

import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";

import { NavBar } from "./nav-bar";
import { type NavLink } from "./nav-links";

const links: NavLink[] = [
  { href: "/admin", label: "Home", exact: true },
  { href: "/admin/bank", label: "Questions" },
  { href: "/admin/schedule", label: "Sittings" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/review", label: "Results", matchGrades: true },
];

function SessionControls({ layout }: { layout: "menu" | "list" }) {
  if (!hasEnvVars) return null;
  return (
    <Suspense fallback={null}>
      <AuthButton layout={layout} />
    </Suspense>
  );
}

export function Nav() {
  return (
    <NavBar
      links={links}
      session={<SessionControls layout="menu" />}
      mobileSession={<SessionControls layout="list" />}
    />
  );
}
