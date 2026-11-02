import { connection } from "next/server";
import { redirect, unstable_rethrow } from "next/navigation";

import { protectedRedirectTarget } from "@/app/auth/routing";
import { readSignedInRole } from "@/app/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export const instant = false;

export default async function ProtectedPage() {
  await connection();

  if (!hasEnvVars) {
    redirect("/auth/login");
  }

  let signedIn = false;
  let role: string | null = null;
  try {
    const supabase = await createClient();
    const auth = await readSignedInRole(supabase);
    signedIn = auth.user != null;
    role = auth.role;
  } catch (error) {
    unstable_rethrow(error);
    redirect("/auth/login");
  }

  const target = protectedRedirectTarget({ signedIn, role });
  if (target) redirect(target);

  return (
    <div className="max-w-2xl space-y-2">
      <h1 className="text-2xl">Your account</h1>
      <p className="text-sm text-muted-foreground">
        You are signed in. This account cannot open the admin pages.
      </p>
    </div>
  );
}
