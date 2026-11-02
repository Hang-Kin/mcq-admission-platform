import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isStaffRole(profile?.role)) {
    return { ok: false as const, status: 403, error: "Staff only." };
  }

  return { ok: true as const, supabase };
}
