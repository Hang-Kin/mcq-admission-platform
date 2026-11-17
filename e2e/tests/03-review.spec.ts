import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";

import { signIn, staffEmail, staffPassword } from "../src/auth";
import { MEDIA_DIR, note, readState, saveVideo, shot, step, writeState } from "../src/media";
import { assertStagingHost, stagingAnonKey } from "../src/guard";

const require = createRequire(path.resolve(__dirname, "../../mcq-app/package.json"));
const ExcelJS = require("exceljs") as typeof import("exceljs");

const FLOW = "03-review";

test.use({ viewport: { width: 1280, height: 900 } });

test.afterEach(async ({ page }, info) => {
  await saveVideo(page, info, "03-review");
});

function accessToken(cookies: Array<{ name: string; value: string }>): string | null {
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

function suspiciousCells(values: string[]): string[] {
  return values.filter((value) => {
    const text = value.trim();
    if (!/^[=+\-@]/.test(text)) return false;
    if (/^="[^"]*"$/.test(text)) return false;
    return true;
  });
}

test("confirm, edit, regrade, and export", async ({ page }) => {
  const state = await readState();
  await signIn(page, staffEmail("admin"), staffPassword("admin"));
  if (!state.examName) {
    await note(FLOW, "review", "fail", "No submitted exam was recorded by the student flow.");
    return;
  }

  await step(FLOW, "open the submitted sitting", async () => {
    await page.goto("/admin/review");
    const heading = page.getByRole("heading", { name: state.examName!, level: 3 });
    await expect(heading).toBeVisible();
    const block = heading.locator("xpath=ancestor::div[1]");
    const link = block.getByRole("link").first();
    const student = (await link.innerText()).trim();
    await link.click();
    await expect(page.getByRole("button", { name: /Confirm all/ })).toBeVisible();
    await writeState({ reviewStudent: student });
    await shot(page, `${FLOW}-sitting`);
    return student;
  });

  await step(FLOW, "confirm one correct answer", async () => {
    const card = page.locator("ol > li").filter({ hasText: "Correct" }).first();
    await card.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(card.getByText(/Confirmed by/)).toBeVisible();
    await shot(page, `${FLOW}-confirmed-one`);
    return "confirmed";
  });

  await step(FLOW, "edit one answer to incorrect with a note", async () => {
    const card = page.locator("ol > li").filter({ hasText: "Unconfirmed" }).first();
    await card.getByRole("button", { name: "Edit", exact: true }).click();
    await card.getByRole("radio", { name: "Incorrect" }).check();
    await card.locator("textarea[name='note']").fill("E2E staging override");
    await card.getByRole("button", { name: "Save edit" }).click();
    await expect(card.getByText(/Overridden by/)).toBeVisible();
    await expect(card.getByText("E2E staging override")).toBeVisible();
    await shot(page, `${FLOW}-edited-incorrect`);
    return "overridden";
  });

  await step(FLOW, "confirm one ungraded answer", async () => {
    const card = page.locator("ol > li").filter({ hasText: "Not graded" }).first();
    if (!(await card.count())) return "No ungraded answer was on this paper.";
    await card.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.waitForTimeout(800);
    const message = (await card.innerText()).replace(/\s+/g, " ").trim();
    await shot(page, `${FLOW}-ungraded-confirm`);
    await note(FLOW, "ungraded confirm exact text", "note", message.slice(0, 800));
    return message.slice(0, 400);
  });

  await step(FLOW, "confirm all and read the skipped count", async () => {
    const before = await page.getByRole("button", { name: /Confirm all/ }).innerText();
    await page.getByRole("button", { name: /Confirm all/ }).click();
    await page.waitForTimeout(1000);
    const region = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    await shot(page, `${FLOW}-confirm-all`);
    const skipped = /skip/i.test(region);
    if (!skipped) {
      throw new Error(`Confirm all did not say how many were skipped. Button was "${before}". Page: ${region.slice(0, 500)}`);
    }
    return region.slice(0, 500);
  });

  await step(FLOW, "change a correct answer and regrade", async () => {
    const card = page.locator("ol > li").first();
    const question = ((await card.locator("h2").innerText()) ?? "").replace(/^\d+\.\s*/, "").trim();
    const previous = (await card.locator("p").filter({ hasText: "Correct answer" }).locator("xpath=following-sibling::p[1]").innerText()).trim();
    const snippet = question.slice(0, 40);
    await page.goto("/admin/questions");
    const row = page.locator("tr").filter({ hasText: snippet }).first();
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: "Edit" }).click();
    const answer = page.locator("#correct_answer, input[name='correct_answer']").first();
    if (await page.locator('input[placeholder^="Choice "]').count()) {
      const choice = page.locator('input[placeholder^="Choice "]').nth(1);
      await choice.fill(`e2e-other-${Date.now().toString().slice(-4)}`);
      await page.locator('input[type="radio"]').nth(1).check();
    } else if (await answer.count()) {
      await answer.fill(`${previous}-e2e`);
    }
    await page.getByRole("button", { name: "Save question" }).click();
    await page.waitForURL(/\/admin\/review\/regrade\//);
    await shot(page, `${FLOW}-regrade-preview`);
    const preview = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    await note(FLOW, "regrade preview", "note", preview.slice(0, 800));
    const apply = page.getByRole("button", { name: "Regrade affected students" });
    if (await apply.isEnabled()) {
      await apply.click();
      await expect(page.getByText(/Regrade saved/)).toBeVisible();
    }
    await shot(page, `${FLOW}-regrade-applied`);
    const after = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const token = accessToken(await page.context().cookies());
    if (!token) throw new Error("Could not read the staff session for the regrade log.");
    const log = await fetch(
      `${assertStagingHost()}/rest/v1/regrade_log?select=question_id,changed_count,preserved_override_count&order=question_id.desc&limit=5`,
      { headers: { apikey: stagingAnonKey(), Authorization: `Bearer ${token}` } },
    );
    const logBody = await log.text();
    await note(FLOW, "regrade log", log.ok && logBody.includes("question_id") ? "pass" : "fail", `HTTP ${log.status} ${logBody.slice(0, 300)}`);
    if (!log.ok) throw new Error(`regrade_log read failed: HTTP ${log.status}`);
    return `${preview.slice(0, 240)} || ${after.slice(0, 240)}`;
  });

  await step(FLOW, "export csv and excel", async () => {
    await page.goto("/admin/review");
    await page.locator("#export-exam").selectOption({ label: state.examName! });
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const csv = await csvDownload;
    const csvPath = path.join(MEDIA_DIR, "03-results.csv");
    await csv.saveAs(csvPath);
    const csvText = await readFile(csvPath, "utf8");
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    const badCsv = suspiciousCells(lines.flatMap((line) => line.split(",")));
    const xlsxDownload = page.waitForEvent("download");
    await page.goto("/admin/review");
    await page.locator("#export-exam").selectOption({ label: state.examName! });
    await page.getByRole("button", { name: "Export Excel" }).click();
    const xlsx = await xlsxDownload;
    const xlsxPath = path.join(MEDIA_DIR, "03-results.xlsx");
    await xlsx.saveAs(xlsxPath);
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(xlsxPath);
    const sheet = book.worksheets[0];
    const badXlsx: string[] = [];
    sheet?.eachRow((row) => {
      row.eachCell((cell) => {
        const value = cell.value == null ? "" : String(cell.value);
        if (/^[=+\-@]/.test(value.trim()) && cell.formula) badXlsx.push(value);
      });
    });
    await shot(page, `${FLOW}-export`);
    if (badCsv.length || badXlsx.length) {
      throw new Error(`Unescaped cells csv=${badCsv.slice(0, 5).join(" | ")} xlsx=${badXlsx.slice(0, 5).join(" | ")}`);
    }
    const hasStudent = state.reviewStudent ? csvText.includes(state.reviewStudent) : true;
    return `rows ${lines.length}; student present ${hasStudent}; csv starts ${lines[0]}`;
  });
});
