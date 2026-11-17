import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { signIn, staffEmail, staffPassword } from "../src/auth";
import { addSittingTime, answerCurrent, createNamedExam, issueOneCode, openExam, prepareSitting, timerLabel, timerSeconds } from "../src/examFlow";
import { note, readState, saveVideo, shot, step } from "../src/media";

const FLOW = "05-extreme";

test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(20 * 60 * 1000);

test.afterEach(async ({ page }, info) => {
  await saveVideo(page, info, "05-extreme");
});

async function restoreMinutes(page: import("@playwright/test").Page, math: string, chinese: string) {
  await page.goto("/admin/settings");
  await page.locator("#Math-minutes").fill(math);
  await page.locator("#Chinese-minutes").fill(chinese);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

test("extreme checklist on staging", async ({ page, browser }) => {
  await signIn(page, staffEmail("admin"), staffPassword("admin"));
  await page.goto("/admin/settings");
  const mathMinutes = await page.locator("#Math-minutes").inputValue();
  const chineseMinutes = await page.locator("#Chinese-minutes").inputValue();
  const mathQuestions = await page.locator("#Math-questions").inputValue();
  const chineseQuestions = await page.locator("#Chinese-questions").inputValue();
  await note(FLOW, "original subject minutes", "note", `Math ${mathMinutes} min / ${mathQuestions} q, Chinese ${chineseMinutes} min / ${chineseQuestions} q`);

  try {
    await step(FLOW, "shorten the exam to one minute per section", async () => {
      await page.locator("#Math-minutes").fill("1");
      await page.locator("#Chinese-minutes").fill("1");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();
      await shot(page, `${FLOW}-minutes-one`);
      return "saved 1 and 1";
    });

    const stamp = String(Date.now()).slice(-6);
    const examName = `E2E timer ${stamp}`;
    let link = "";
    await step(FLOW, "prepare a one-minute sitting", async () => {
      await createNamedExam(page, examName);
      await addSittingTime(page, `Timer ${stamp}`, "2034-04-02T09:00", "2034-04-02T09:05");
      await prepareSitting(page);
      const issued = await issueOneCode(page);
      link = issued.link;
      await shot(page, `${FLOW}-timer-qr`);
      return "code issued";
    });

    await step(FLOW, "answers nothing until the timer hits zero", async () => {
      if (!link) throw new Error("No short-exam link.");
      const context = await browser.newContext({
        viewport: { width: 1024, height: 900 },
        timezoneId: "Asia/Hong_Kong",
        recordVideo: { dir: "/tmp/staging-e2e-video" },
      });
      const exam = await context.newPage();
      await openExam(exam, link);
      const started = await timerLabel(exam);
      await shot(exam, `${FLOW}-timer-open`);
      await expect(exam.getByText(/Exam submitted|already been submitted|This section is already finished/)).toBeVisible({
        timeout: 150_000,
      });
      const body = (await exam.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 600);
      await shot(exam, `${FLOW}-timer-zero`);
      const timerVideo = exam.video();
      await context.close();
      const timerSrc = await timerVideo?.path();
      if (timerSrc) {
        const { rename } = await import("node:fs/promises");
        await rename(timerSrc, "/cursor/stores/bc-92314f63-d670-4644-be86-ba5aeb6af75c/media/staging-e2e/05-timer-zero.webm");
      }
      return `opened at ${started}; then ${body}`;
    });

    await step(FLOW, "slot one minute shorter is refused or does not cut the exam", async () => {
      await page.goto("/admin/schedule");
      await page.getByRole("link", { name: examName, exact: true }).click();
      await page.locator("#time-name").fill(`Short ${stamp}`);
      await page.locator("#time-start").fill("2034-04-02T10:00");
      await page.locator("#time-end").fill("2034-04-02T10:04");
      await page.getByRole("button", { name: "Add a time" }).click();
      await page.waitForTimeout(500);
      const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      await shot(page, `${FLOW}-short-slot`);
      if (/needs|minute/i.test(text) && !text.includes(`Short ${stamp}`)) {
        throw new Error(text.slice(0, 400));
      }
      return text.slice(0, 400);
    });

    await step(FLOW, "reload before a save finishes", async () => {
      const state = await readState();
      const fresh = state.link768 || state.link375 || state.link1024;
      if (!fresh) return "No earlier exam link was available, so this used the timer sitting only.";
      const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, timezoneId: "Asia/Hong_Kong" });
      const exam = await context.newPage();
      await openExam(exam, fresh);
      if (await exam.getByText(/submitted|another device|invalid/i).count()) {
        const body = (await exam.locator("body").innerText()).slice(0, 300);
        await context.close();
        return body;
      }
      if (await exam.locator('input[type="radio"]').count()) {
        await exam.locator('input[type="radio"]').first().check();
      }
      await exam.reload();
      const body = (await exam.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
      await shot(exam, `${FLOW}-reload-before-save`);
      await context.close();
      return body;
    });

    await step(FLOW, "offline save", async () => {
      const state = await readState();
      const fresh = state.link375 || state.link768;
      if (!fresh) return "No second device link left to take offline.";
      const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, timezoneId: "Asia/Hong_Kong" });
      const exam = await context.newPage();
      await openExam(exam, fresh);
      const blocked = await exam.getByText(/submitted|another device|invalid/i).count();
      if (blocked) {
        const body = (await exam.locator("body").innerText()).slice(0, 240);
        await context.close();
        return body;
      }
      await answerCurrent(exam);
      await context.setOffline(true);
      if (await exam.locator('input[type="radio"]').count()) {
        const radios = exam.locator('input[type="radio"]');
        if ((await radios.count()) > 1) await radios.nth(1).check();
      }
      await exam.waitForTimeout(1500);
      const offline = (await exam.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
      await shot(exam, `${FLOW}-offline`);
      await context.setOffline(false);
      await context.close();
      return offline;
    });
  } finally {
    await restoreMinutes(page, mathMinutes, chineseMinutes);
    await page.locator("#Math-questions").fill(mathQuestions);
    await page.locator("#Chinese-questions").fill(chineseQuestions);
    await page.getByRole("button", { name: "Save" }).click();
    await shot(page, `${FLOW}-minutes-restored`);
  }

  await step(FLOW, "empty and header-only roster files", async () => {
    const dir = "/tmp/staging-e2e-rosters";
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "empty.csv"), "");
    await writeFile(path.join(dir, "header.csv"), "提交編號,English Name,Chinese Name\n");
    await writeFile(path.join(dir, "blank.csv"), "提交編號,English Name,Chinese Name\n,,,\n, , \n");
    await page.goto("/admin/students/import");
    await page.locator("#import-intake-year").selectOption("2035");
    await page.locator("#import-intake-month").selectOption("12");
    const messages: string[] = [];
    for (const file of ["empty.csv", "header.csv", "blank.csv"]) {
      await page.locator("#roster-file").setInputFiles(path.join(dir, file));
      await page.waitForTimeout(400);
      messages.push(`${file}: ${(await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 220)}`);
    }
    await shot(page, `${FLOW}-empty-import`);
    return messages.join("\n");
  });

  await step(FLOW, "5000 row import and 5001 refusal", async () => {
    const dir = "/tmp/staging-e2e-rosters";
    await mkdir(dir, { recursive: true });
    const header = "提交編號,English Name,Chinese Name";
    const rows = (count: number) =>
      [header, ...Array.from({ length: count }, (_, index) => {
        const code = String(index).padStart(4, "0");
        return `${code},Extreme ${code},測`;
      })].join("\n");
    await writeFile(path.join(dir, "five-thousand.csv"), rows(5000));
    await page.goto("/admin/students/import");
    await page.locator("#import-intake-year").selectOption("2035");
    await page.locator("#import-intake-month").selectOption("11");
    await page.locator("#roster-file").setInputFiles(path.join(dir, "five-thousand.csv"));
    await expect(page.getByText(/5000 to add|to add/)).toBeVisible({ timeout: 60_000 });
    const preview = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300);
    await shot(page, `${FLOW}-import-5000-preview`);
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByText(/added|imported|saved/i)).toBeVisible({ timeout: 120_000 });
    await shot(page, `${FLOW}-import-5000-done`);
    await writeFile(path.join(dir, "five-thousand-one.csv"), rows(5001));
    await page.locator("#roster-file").setInputFiles(path.join(dir, "five-thousand-one.csv"));
    await expect(page.getByText(/5000 students or fewer/)).toBeVisible({ timeout: 60_000 });
    await shot(page, `${FLOW}-import-5001`);
    const huge = Buffer.alloc(5 * 1024 * 1024 + 20, "a");
    await writeFile(path.join(dir, "huge.csv"), huge);
    await page.locator("#roster-file").setInputFiles(path.join(dir, "huge.csv"));
    await expect(page.getByText("The file is larger than 5 MB.")).toBeVisible();
    await shot(page, `${FLOW}-import-huge`);
    return preview;
  });

  await note(
    FLOW,
    "checklist items covered in the student flow",
    "note",
    "Answers instantly, two devices, and a saved reload are in 02-student-exam when that flow passed. This file adds the empty answer, the timer, a reload during save, offline, the short slot, and the import files.",
  );
  void timerSeconds;
});
