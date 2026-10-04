import { Suspense, type ReactNode } from "react";

import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";

import { NavBar, type NavLink } from "./nav-bar";

const links: NavLink[] = [
  { href: "/", label: "Home", exact: true },
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/review", label: "Review" },
  { href: "/protected", label: "Account" },
];

function SessionControls() {
  if (!hasEnvVars) return null;
  return (
    <Suspense fallback={null}>
      <AuthButton />
    </Suspense>
  );
}

export function Nav() {
  return (
    <NavBar
      links={links}
      session={<SessionControls />}
      mobileSession={<SessionControls />}
    />
  );
}
