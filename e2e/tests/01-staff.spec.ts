import { expect, test } from "@playwright/test";

import { signIn, staffEmail, staffPassword } from "../src/auth";
import { note, saveVideo, shot, step } from "../src/media";
import {
  SESSION_RPCS,
  STAFF_RPCS,
  TABLES,
  callRpc,
  readTable,
  signInWithPassword,
  summarize,
} from "../src/rpc";

const FLOW = "01-staff";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1280, height: 900 } });

test.afterEach(async ({ page }, info) => {
  await saveVideo(page, info, info.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
});

async function crudQuestion(page: import("@playwright/test").Page, who: string, stamp: string) {
  await page.goto("/admin/bank/Math");
  await shot(page, `${FLOW}-${who}-bank`);
  const topic = page.locator('a[href^="/admin/bank/Math/"]').first();
  await expect(topic).toBeVisible();
  await topic.click();
  await page.getByRole("link", { name: "Add question" }).click();
  const text = `E2E ${who} choice ${stamp}`;
  await page.locator("form").last().locator("textarea").fill(text);
  const choices = page.locator('input[placeholder^="Choice "]');
  await choices.nth(0).fill("red");
  await choices.nth(1).fill("blue");
  await page.getByRole("button", { name: "Save question" }).click();
  await expect(page.getByText("Question saved.")).toBeVisible();
  await shot(page, `${FLOW}-${who}-question-added`);
  await page.locator("main").getByRole("link").nth(2).click();
  await expect(page.getByRole("link", { name: "Add question" })).toBeVisible();
  const row = page.locator("li").filter({ hasText: text });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Edit" }).click();
  await page.waitForURL(/\/edit/);
  await page.locator("form").last().locator("textarea").fill(`${text} edited`);
  await page.getByRole("button", { name: "Save question" }).click();
  await expect(page.getByText(`${text} edited`).first()).toBeVisible();
  await shot(page, `${FLOW}-${who}-question-edited`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("li").filter({ hasText: `${text} edited` }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(`${text} edited`)).toHaveCount(0);
  await shot(page, `${FLOW}-${who}-question-deleted`);
}

test("staff sign-in, question changes, and pending account", async ({ page, browser }) => {
  const stamp = String(Date.now());

  const adminHome = await step(FLOW, "admin reaches /admin", async () => {
    await signIn(page, staffEmail("admin"), staffPassword("admin"));
    await expect(page).toHaveURL(/\/admin/);
    await shot(page, `${FLOW}-admin-home`);
    return page.url();
  });
  expect(adminHome).toBeTruthy();

  await step(FLOW, "admin add edit delete question", async () => {
    await crudQuestion(page, "admin", stamp);
  });

  await page.context().clearCookies();
  const teacherHome = await step(FLOW, "teacher reaches /admin", async () => {
    await signIn(page, staffEmail("teacher"), staffPassword("teacher"));
    await expect(page).toHaveURL(/\/admin/);
    await shot(page, `${FLOW}-teacher-home`);
    return page.url();
  });
  expect(teacherHome).toBeTruthy();

  await step(FLOW, "teacher add edit delete question", async () => {
    await crudQuestion(page, "teacher", stamp);
  });

  const olderDelete = await step(FLOW, "teacher older question list shows delete", async () => {
    await page.goto("/admin/questions");
    await shot(page, `${FLOW}-teacher-older-questions`);
    const deletes = await page.getByRole("button", { name: "Delete" }).count();
    if (deletes === 0) {
      throw new Error("The older questions page shows no Delete button for the teacher.");
    }
    return `delete buttons: ${deletes}`;
  });
  void olderDelete;

  const signup = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const signupPage = await signup.newPage();
  const email = `e2e-${stamp}@example.com`;
  const password = `E2e-${stamp}-Aa1!`;
  let signedUp = false;
  await step(FLOW, "sign-up page creates an account", async () => {
    await signupPage.goto("/auth/sign-up");
    await shot(signupPage, `${FLOW}-signup-empty`);
    await signupPage.locator("#email").fill(email);
    await signupPage.locator("#password").fill(password);
    await signupPage.locator("#repeat-password").fill(password);
    await signupPage.getByRole("button", { name: "Sign up" }).click();
    try {
      await signupPage.waitForURL(/sign-up-success|\/protected|\/admin/, { timeout: 30_000 });
    } catch {
      const alert = signupPage.getByRole("alert");
      const message = (await alert.count()) ? (await alert.innerText()).trim() : "";
      const body = (await signupPage.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
      throw new Error(message || body);
    }
    await shot(signupPage, `${FLOW}-signup-result`);
    signedUp = true;
    return signupPage.url().replace(/\?.*/, "");
  });

  await step(FLOW, "new account cannot open /admin", async () => {
    if (!signedUp) throw new Error("Sign-up did not finish.");
    await signupPage.goto("/auth/login");
    await signupPage.locator("#email").fill(email);
    await signupPage.locator("#password").fill(password);
    await signupPage.getByRole("button", { name: "Sign in" }).click();
    await signupPage.waitForLoadState("networkidle");
    const loginError = signupPage.getByRole("alert");
    if (await loginError.count()) throw new Error((await loginError.innerText()).trim());
    await shot(signupPage, `${FLOW}-pending-after-login`);
    const url = signupPage.url();
    if (url.includes("/auth/login")) throw new Error("The new account was still on the sign-in page.");
    if (url.includes("/admin")) throw new Error("The new account opened /admin.");
    await signupPage.goto("/admin");
    await signupPage.waitForLoadState("networkidle");
    await shot(signupPage, `${FLOW}-pending-admin-blocked`);
    if (signupPage.url().includes("/admin") && !signupPage.url().includes("/auth")) {
      throw new Error(`New account stayed on ${signupPage.url()}.`);
    }
    return `landed on ${signupPage.url().replace(/\?.*/, "")}`;
  });

  await step(FLOW, "pending account cannot read staff tables or call staff RPCs", async () => {
    const session = await signInWithPassword(email, password);
    if (!session.accessToken) throw new Error(`Could not sign in the new account: ${session.error}`);
    const lines: string[] = [];
    const roleCall = await fetch(
      `${process.env.STAGING_SUPABASE_URL!.trim().replace(/\/$/, "")}/rest/v1/profiles?select=role&id=eq.${session.userId}`,
      {
        headers: {
          apikey: process.env.STAGING_SUPABASE_ANON_KEY!.trim(),
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
    );
    const roleBody = await roleCall.text();
    lines.push(`profile HTTP ${roleCall.status} ${roleBody.slice(0, 120)}`);
    for (const table of TABLES) {
      const result = await readTable(table, session.accessToken);
      const summary = summarize(result);
      lines.push(`${table} ${summary}`);
      if (Array.isArray(result.body) && result.body.length > 0) {
        throw new Error(`${table} returned a row to the new account. ${summary}`);
      }
    }
    for (const rpc of STAFF_RPCS) {
      const result = await callRpc(rpc.name, rpc.args, session.accessToken);
      const summary = summarize(result);
      lines.push(`${rpc.name} ${summary}`);
      const blob = JSON.stringify(result.body);
      const blocked =
        result.status >= 400 ||
        /not_staff|permission|denied|error/i.test(blob);
      if (!blocked) throw new Error(`${rpc.name} was not rejected: ${summary}`);
    }
    return lines.join("\n");
  });

  await step(FLOW, "signed-out anon key cannot read tables or start an exam", async () => {
    const lines: string[] = [];
    for (const table of TABLES) {
      const result = await readTable(table, null);
      const summary = summarize(result);
      lines.push(`${table} ${summary}`);
      if (Array.isArray(result.body) && result.body.length > 0) {
        throw new Error(`${table} returned a row to the anon key. ${summary}`);
      }
    }
    for (const rpc of SESSION_RPCS) {
      const result = await callRpc(rpc.name, rpc.args, null);
      const summary = summarize(result);
      lines.push(`${rpc.name} ${summary}`);
      const blob = JSON.stringify(result.body);
      const ok = result.status < 400 && /"ok"\s*:\s*true/.test(blob);
      if (ok) throw new Error(`${rpc.name} succeeded without a session token: ${summary}`);
    }
    return lines.join("\n");
  });

  await note(FLOW, "signup identity", "note", signedUp ? "Sign-up left the form for a success or home page." : "Sign-up did not leave the form.");
  await signup.close();
});
