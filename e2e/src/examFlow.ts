import { readFile } from "node:fs/promises";

import { expect, type Browser, type Download, type Page } from "@playwright/test";

import { sessionLinksFromPdf } from "./qr";

export type AnswerSnap = {
  index: number;
  kind: string;
  value: string;
};

export async function createNamedExam(page: Page, name: string) {
  await page.goto("/admin/schedule?new=1");
  await page.locator("#exam-name").fill(name);
  await page.locator("form").filter({ has: page.locator("#exam-name") }).getByRole("button", { name: "Create exam" }).click();
  await expect(page.locator("#exam-name")).toHaveValue("");
  await page.goto("/admin/schedule");
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sittings" })).toBeVisible();
}

export async function addSittingTime(page: Page, label: string, start: string, end: string) {
  await page.locator("#time-name").fill(label);
  await page.locator("#time-start").fill(start);
  await page.locator("#time-end").fill(end);
  await page.getByRole("button", { name: "Add a time" }).click();
  await page.waitForTimeout(1200);
  await page.reload();
  const created = page.getByText(label).first();
  if (!(await created.isVisible().catch(() => false))) {
    const formError = page.locator(".text-destructive").first();
    const message = (await formError.count()) ? (await formError.innerText()).trim() : "The new sitting time did not appear.";
    throw new Error(message);
  }
}

export async function prepareSitting(page: Page) {
  const button = page.getByRole("button", { name: "Prepare questions" }).first();
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole("button", { name: "Redraw" }).first()).toBeVisible({ timeout: 60_000 });
}

export async function issueOneCode(page: Page): Promise<{ student: string; link: string }> {
  const rows = page.locator("ul li").filter({ has: page.getByRole("checkbox") });
  const count = await rows.count();
  let chosen = -1;
  let student = "";
  for (let index = 0; index < count; index += 1) {
    const text = (await rows.nth(index).innerText()).replace(/\s+/g, " ").trim();
    if (/already started|finished|in progress|submitted/i.test(text)) continue;
    if (chosen < 0) {
      chosen = index;
      student = text;
    }
    if (/test/i.test(text)) {
      chosen = index;
      student = text;
      break;
    }
  }
  if (chosen < 0) throw new Error("No seeded student is still waiting to start.");
  await rows.nth(chosen).getByRole("checkbox").click();
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
    throw new Error(`QR request failed (${response.status()}): ${body.slice(0, 300)}`);
  }
  let bytes: Uint8Array;
  if (download) {
    const saved = await download.path();
    if (!saved) throw new Error("The QR download had no file.");
    bytes = new Uint8Array(await readFile(saved));
  } else {
    bytes = new Uint8Array(await response.body());
  }
  const head = Buffer.from(bytes.subarray(0, 5)).toString("utf8");
  if (head !== "%PDF-") {
    const preview = Buffer.from(bytes.subarray(0, 80)).toString("utf8").replace(/\s+/g, " ");
    throw new Error(`QR response was not a PDF (${bytes.length} bytes): ${preview}`);
  }
  const links = await sessionLinksFromPdf(bytes);
  if (links.length !== 1) {
    throw new Error(`Expected 1 session link in the QR sheet, found ${links.length}.`);
  }
  return { student, link: links[0]! };
}

async function currentIndex(page: Page): Promise<number> {
  const current = page.locator('nav button[aria-current="true"]');
  const label = await current.evaluate((element) => element.textContent ?? "");
  const match = /Question (\d+)/.exec(label);
  if (match) return Number(match[1]);
  const visible = (await current.innerText()).trim();
  if (/^\d+$/.test(visible)) return Number(visible);
  throw new Error(`Could not read the current question number from "${label.slice(0, 80)}".`);
}

async function answerValue(page: Page): Promise<{ kind: string; value: string }> {
  if (await page.locator('input[type="radio"]').count()) {
    const checked = page.locator('input[type="radio"]:checked');
    const value = (await checked.count()) ? await checked.first().inputValue() : "";
    return { kind: "radio", value };
  }
  if (await page.locator("#numeric-answer").count()) {
    return { kind: "numeric", value: await page.locator("#numeric-answer").inputValue() };
  }
  if (await page.locator("#fraction-numerator").count()) {
    const numerator = await page.locator("#fraction-numerator").inputValue();
    const denominator = await page.locator("#fraction-denominator").inputValue();
    return { kind: "fraction", value: `${numerator}/${denominator}` };
  }
  if (await page.locator("textarea").count()) {
    return { kind: "text", value: await page.locator("textarea").inputValue() };
  }
  return { kind: "unknown", value: "" };
}

export async function answerCurrent(page: Page): Promise<AnswerSnap> {
  const index = await currentIndex(page);
  let kind = "unknown";
  if (await page.locator('input[type="radio"]').count()) {
    await page.locator('input[type="radio"]').first().check();
    kind = "radio";
  } else if (await page.locator("#numeric-answer").count()) {
    await page.locator("#numeric-answer").fill("4");
    kind = "numeric";
  } else if (await page.locator("#fraction-numerator").count()) {
    await page.locator("#fraction-numerator").fill("1");
    await page.locator("#fraction-denominator").fill("2");
    kind = "fraction";
  } else if (await page.locator("textarea").count()) {
    await page.locator("textarea").fill("staging written answer");
    kind = "text";
  } else {
    throw new Error(`No answer control on question ${index}.`);
  }
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  const value = (await answerValue(page)).value;
  return { index, kind, value };
}

export async function readAnswerAt(page: Page, index: number): Promise<string> {
  await page.locator("nav button").filter({ hasText: `Question ${index},` }).first().click();
  await page.waitForTimeout(250);
  return (await answerValue(page)).value;
}

export function timerSeconds(label: string): number | null {
  const match = /(\d+):(\d{2})(?::(\d{2}))?/.exec(label);
  if (!match) return null;
  if (match[3]) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number(match[1]) * 60 + Number(match[2]);
}

export async function timerLabel(page: Page): Promise<string> {
  return (await page.locator("header p.tabular-nums").first().innerText()).trim();
}

export async function openExam(page: Page, link: string) {
  await page.goto(link);
  await expect(page.getByText(/Opening your exam|Time remaining|This /)).toBeVisible();
  await expect(page.getByText("Opening your exam…")).toBeHidden({ timeout: 30_000 });
}

async function openLastQuestion(page: Page) {
  const nav = page.locator("header nav").first();
  const buttons = nav.locator("button");
  const count = await buttons.count();
  if (count > 0) await buttons.nth(count - 1).click();
}

export async function finishOrSubmit(page: Page) {
  for (let guard = 0; guard < 8; guard += 1) {
    if (await page.getByText("Exam submitted").first().count()) return "Exam submitted";
    const finish = page.locator("footer").getByRole("button", { name: /^Finish / }).last();
    const submit = page.locator("footer").getByRole("button", { name: "Submit exam" }).last();
    await openLastQuestion(page);
    if (await finish.count()) {
      await finish.click();
      await page.getByRole("button", { name: "Finish now" }).click();
      await page.waitForTimeout(500);
      continue;
    }
    if (await submit.count()) {
      await submit.click();
      await page.getByRole("button", { name: "Submit now" }).click();
      await expect(page.getByText("Exam submitted")).toBeVisible({ timeout: 30_000 });
      return "Exam submitted";
    }
    await page.waitForTimeout(500);
  }
  if (await page.getByText("Exam submitted").count()) return "Exam submitted";
  throw new Error("The exam did not reach a submitted screen.");
}

export async function blankFinishCancel(page: Page): Promise<string> {
  await openLastQuestion(page);
  const finish = page.locator("footer").getByRole("button", { name: /^Finish / }).last();
  await expect(finish).toBeVisible();
  await finish.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const text = (await dialog.innerText()).replace(/\s+/g, " ").trim();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(finish).toBeVisible();
  return text;
}

export async function otherDevice(browser: Browser, link: string, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: width < 500 ? 800 : 900 },
    timezoneId: "Asia/Hong_Kong",
  });
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByText("Opening your exam…")).toBeHidden({ timeout: 30_000 });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  await context.close();
  return text.slice(0, 500);
}

export async function pdfBytes(downloadPath: string) {
  return new Uint8Array(await readFile(downloadPath));
}
