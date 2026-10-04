import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/staffRole";
import { hasEnvVars } from "@/lib/utils";

import { NavBar, type NavLink } from "./nav-bar";

const home: NavLink = { href: "/", label: "Home", exact: true };
const dashboard: NavLink = { href: "/admin", label: "Dashboard", exact: true };
const exams: NavLink = { href: "/admin/exams", label: "Exams" };
const questions: NavLink = { href: "/admin/questions", label: "Questions" };
const students: NavLink = { href: "/admin/students", label: "Students" };
const review: NavLink = { href: "/admin/review", label: "Review" };
const account: NavLink = { href: "/protected", label: "Account" };
const signIn: NavLink = { href: "/auth/login", label: "Sign in" };
const signUp: NavLink = { href: "/auth/sign-up", label: "Sign up" };

const staffLinks: NavLink[] = [
  home,
  dashboard,
  exams,
  questions,
  students,
  review,
];

const allLinks: NavLink[] = [...staffLinks, account, signIn, signUp];

export function NavFallback() {
  return <NavBar links={[home]} email={null} />;
}

export async function Nav() {
  if (!hasEnvVars) {
    return <NavBar links={allLinks} email={null} />;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return <NavBar links={[home, signIn, signUp]} email={null} />;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      return (
        <NavBar links={allLinks} email={user.email ?? null} showLogout />
      );
    }

    if (isStaffRole(profile.role)) {
      return (
        <NavBar links={staffLinks} email={user.email ?? null} showLogout />
      );
    }

    return (
      <NavBar links={[home, account]} email={user.email ?? null} showLogout />
    );
  } catch {
    return <NavBar links={allLinks} email={null} />;
  }
}
