"use server";

import { refresh, revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";

import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

import { postSignInPath } from "./routing";
import { readSignedInRole } from "./session";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AuthFormState = { error: string } | null;

function refreshNav() {
  revalidatePath("/", "layout");
  refresh();
}

async function roleAfterAuth(supabase: Supabase) {
  try {
    const { role } = await readSignedInRole(supabase);
    return role;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

export async function signIn(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  if (!hasEnvVars) return { error: "Sign-in is not configured." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const role = await roleAfterAuth(supabase);
  refreshNav();
  redirect(postSignInPath(role));
}

export async function signUp(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  if (password !== repeat) return { error: "Passwords do not match" };
  if (!hasEnvVars) return { error: "Sign-up is not configured." };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: origin ? { emailRedirectTo: `${origin}/protected` } : undefined,
  });
  if (error) return { error: error.message };

  if (!data.session) {
    redirect("/auth/sign-up-success");
  }

  const role = await roleAfterAuth(supabase);
  refreshNav();
  redirect(postSignInPath(role));
}

export async function signOut() {
  if (hasEnvVars) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  refreshNav();
  redirect("/auth/login");
}
