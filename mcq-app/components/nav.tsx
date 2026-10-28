import { Suspense } from "react";

import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";

import { NavBar, type NavLink } from "./nav-bar";

const links: NavLink[] = [
  { href: "/", label: "Home", exact: true },
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/bank", label: "Question bank" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/review", label: "Review" },
  { href: "/admin/advanced", label: "Advanced" },
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
