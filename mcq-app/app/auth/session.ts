import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function readSignedInRole(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null, staff: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = typeof profile?.role === "string" ? profile.role : null;

  return {
    user: { email: user.email ?? null },
    role,
    staff: isStaffRole(role),
  };
}
