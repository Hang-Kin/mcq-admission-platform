import type { Page } from "@playwright/test";

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(admin|protected)(\/|$|\?)/, { timeout: 30_000 });
}

export function staffEmail(which: "admin" | "teacher"): string {
  const value =
    which === "admin"
      ? process.env.STAGING_ADMIN_EMAIL
      : process.env.STAGING_TEACHER_EMAIL;
  if (!value?.trim()) throw new Error(`Missing staging ${which} email.`);
  return value.trim();
}

export function staffPassword(which: "admin" | "teacher"): string {
  const value =
    which === "admin"
      ? process.env.STAGING_ADMIN_PASSWORD
      : process.env.STAGING_TEACHER_PASSWORD;
  if (!value?.trim()) throw new Error(`Missing staging ${which} password.`);
  return value.trim();
}
