import { readFile } from "node:fs/promises";

import { expect, type Download, type Page } from "@playwright/test";

import { sessionLinksFromPdf } from "./qr";

export function redact(value: string): string {
  return value.replace(/[^\s@<>]+@[^\s@<>]+/g, "[email]").replace(/\s+/g, " ").trim();
}

export function keepSpaces(value: string): string {
  return value.replace(/[^\s@<>]+@[^\s@<>]+/g, "[email]");
}

/** datetime-local wall clock in Hong Kong, which is how the sitting form is read. */
export function hongKongLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const bag: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const hour = bag.hour === "24" ? "00" : bag.hour;
  return `${bag.year}-${bag.month}-${bag.day}T${hour}:${bag.minute}`;
}

export function plain(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function bodyText(page: Page, limit = 700): Promise<string> {
  const text = await page.locator("body").innerText().catch(() => "");
  return plain(text).slice(0, limit);
}

export async function selectSeedIntake(page: Page): Promise<string> {
  const intake = page.locator("#qr-intake");
  if ((await intake.count()) === 0) return "no intake list";
  const options = await intake.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: (node as HTMLOptionElement).value,
      label: (node.textContent ?? "").trim(),
    })),
  );
  const match =
    options.find((option) => option.value.startsWith("2026-")) ??
    options.find((option) => /2026/.test(option.label));
  if (!match) return `no 2026 intake among ${options.length}`;
  await intake.selectOption(match.value);
  return match.label || match.value;
}

export async function issueCode(
  page: Page,
  options?: { preferName?: string; excludeName?: string },
): Promise<{ student: string; name: string; link: string }> {
  await page.locator("#codes").scrollIntoViewIfNeeded();
  await selectSeedIntake(page);
  const rows = page.locator("ul li").filter({ has: page.getByRole("checkbox") });
  const count = await rows.count();
  let chosen = -1;
  let student = "";
  let name = "";
  for (let index = 0; index < count; index += 1) {
    const raw = await rows.nth(index).innerText();
    const text = plain(raw);
    const rowName = raw.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? text;
    if (/already started|finished|in progress|submitted/i.test(text)) continue;
    if (options?.excludeName && rowName === options.excludeName) continue;
    if (options?.preferName) {
      if (rowName === options.preferName) {
        chosen = index;
        student = text;
        name = rowName;
        break;
      }
      continue;
    }
    if (chosen < 0) {
      chosen = index;
      student = text;
      name = rowName;
    }
    if (/test/i.test(rowName)) {
      chosen = index;
      student = text;
      name = rowName;
      break;
    }
  }
  if (chosen < 0) {
    throw new Error(
      options?.preferName
        ? `Could not find ${options.preferName} still waiting.`
        : "No seeded student is still waiting to start.",
    );
  }
  const box = rows.nth(chosen).getByRole("checkbox");
  if (!(await box.isChecked())) await box.check();
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/admin/qr-pdf") && response.request().method() === "POST",
    { timeout: 60_000 },
  );
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
  await page.getByRole("button", { name: "Create QR codes" }).click();
  const response = await responsePromise;
  const download = (await downloadPromise) as Download | null;
  const type = response.headers()["content-type"] ?? "";
  if (!response.ok() || !type.includes("pdf")) {
    const body = await response.text();
    throw new Error(`QR request failed (${response.status()}): ${redact(body).slice(0, 300)}`);
  }
  let bytes: Uint8Array;
  if (download) {
    const saved = await download.path();
    if (!saved) throw new Error("The QR download had no file.");
    bytes = new Uint8Array(await readFile(saved));
  } else {
    bytes = new Uint8Array(await response.body());
  }
  const links = await sessionLinksFromPdf(bytes);
  if (links.length !== 1) throw new Error(`Expected 1 session link, found ${links.length}.`);
  return { student, name, link: links[0]! };
}

export async function selectExam(page: Page, name: string) {
  const subtitle = page.locator("p").filter({ hasText: `${name}. Math, then Chinese` });
  if ((await subtitle.count()) === 0) {
    await page.goto("/admin/schedule");
    await page.getByRole("link", { name, exact: true }).click();
  }
  await expect(subtitle).toBeVisible();
}

export async function addTime(page: Page, label: string, start: string, end: string) {
  await page.locator("#time-name").fill(label);
  await page.locator("#time-start").fill(start);
  await page.locator("#time-end").fill(end);
  await page.getByRole("button", { name: "Add a time" }).click();
  const card = page.locator("[id^='sitting-']").filter({ hasText: label });
  const error = page.locator("form .text-destructive").first();
  await expect(card.or(error)).toBeVisible({ timeout: 20_000 });
  if ((await card.count()) === 0) throw new Error(plain(await error.innerText()));
  const url = page.url();
  await page.reload();
  if (!page.url().includes("exam=") && url.includes("exam=")) await page.goto(url);
  await expect(page.locator("[id^='sitting-']").filter({ hasText: label })).toBeVisible();
}

export async function prepareCard(page: Page, label: string) {
  const card = page.locator("[id^='sitting-']").filter({ hasText: label });
  await expect(card).toBeVisible();
  const button = card.getByRole("button", { name: "Prepare questions" });
  if ((await button.count()) === 0) {
    const names = await card.getByRole("button").allTextContents();
    throw new Error(`No Prepare button on ${label}. Buttons: ${names.join(" | ")}`);
  }
  await button.click();
  await expect(card.getByRole("button", { name: "Redraw" })).toBeVisible({ timeout: 90_000 });
}

export async function showQuestion(page: Page, snippet: string) {
  const buttons = page.locator("header nav button");
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    await buttons.nth(index).click();
    if (await page.getByText(snippet).count()) return;
  }
  throw new Error(`Could not find “${snippet}” among ${count} questions in this section.`);
}

export async function answerExact(page: Page, kind: "numeric" | "fraction" | "text", value: string) {
  if (kind === "numeric") {
    await page.locator("#numeric-answer").fill(value);
  } else if (kind === "fraction") {
    const [numerator, denominator] = value.split("/");
    await page.locator("#fraction-numerator").fill(numerator ?? "");
    await page.locator("#fraction-denominator").fill(denominator ?? "");
  } else {
    await page.locator("#text-answer").fill(value);
  }
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
}

export async function currentAnswerText(page: Page): Promise<string> {
  if (await page.locator('input[type="radio"]').count()) {
    const checked = page.locator('input[type="radio"]:checked');
    return (await checked.count()) ? await checked.first().inputValue() : "";
  }
  if (await page.locator("#numeric-answer").count()) return page.locator("#numeric-answer").inputValue();
  if (await page.locator("#fraction-numerator").count()) {
    const numerator = await page.locator("#fraction-numerator").inputValue();
    const denominator = await page.locator("#fraction-denominator").inputValue();
    return `${numerator}/${denominator}`;
  }
  if (await page.locator("#text-answer").count()) {
    return page.locator("#text-answer").evaluate((node) => (node as HTMLTextAreaElement).value);
  }
  return "";
}

export function accessToken(cookies: Array<{ name: string; value: string }>): string | null {
  const chunks = cookies
    .filter((cookie) => cookie.name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (chunks.length === 0) return null;
  let raw = chunks.map((cookie) => cookie.value).join("");
  if (raw.startsWith("base64-")) {
    const padded = raw.slice("base64-".length).replace(/-/g, "+").replace(/_/g, "/");
    raw = Buffer.from(padded, "base64").toString("utf8");
  }
  try {
    const parsed = JSON.parse(raw) as { access_token?: string };
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}
