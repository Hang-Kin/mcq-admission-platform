import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-3">
      <span className="max-w-[14rem] truncate text-sm text-primary-foreground/80">
        {user.email}
      </span>
      <LogoutButton className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary" />
    </div>
  ) : (
    <div className="flex gap-2">
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
