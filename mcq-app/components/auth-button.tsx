import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function AuthButton({ layout = "menu" }: { layout?: "menu" | "list" }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claims) {
    const email = typeof claims.email === "string" ? claims.email : "";
    return <AccountMenu email={email} layout={layout} />;
  }

  return (
    <div className={layout === "list" ? "flex flex-col gap-2" : "flex gap-2"}>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
      >
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant="secondary">
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
