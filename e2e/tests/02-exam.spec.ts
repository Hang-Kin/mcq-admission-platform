import { expect, test } from "@playwright/test";

import { signIn, staffEmail, staffPassword } from "../src/auth";
import {
  addSittingTime,
  answerCurrent,
  blankFinishCancel,
  createNamedExam,
  finishOrSubmit,
  issueOneCode,
  openExam,
  otherDevice,
  prepareSitting,
  readAnswerAt,
  timerLabel,
  timerSeconds,
  type AnswerSnap,
} from "../src/examFlow";
import { note, readState, saveVideo, shot, step, writeState } from "../src/media";

const FLOW = "02-student-exam";

test.use({ viewport: { width: 1024, height: 900 } });

test.afterEach(async ({ page }, info) => {
  await saveVideo(page, info, "02-student-exam");
});

async function staffChromeAbsent(page: import("@playwright/test").Page) {
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Home" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings" })).toHaveCount(0);
}

async function runWidth(
  page: import("@playwright/test").Page,
  browser: import("@playwright/test").Browser,
  link: string,
  width: number,
  full: boolean,
) {
  await page.setViewportSize({ width, height: width < 500 ? 800 : 900 });
  await openExam(page, link);
  await staffChromeAbsent(page);
  await shot(page, `${FLOW}-${width}-opened`);
  const answered: AnswerSnap[] = [];
  const target = full ? 5 : 1;
  for (let count = 0; count < target; count += 1) {
    answered.push(await answerCurrent(page));
    const next = page.locator("footer").getByRole("button", { name: "Next" }).last();
    if ((await next.count()) > 0 && (await next.isEnabled())) await next.click();
  }
  const beforeTimer = timerSeconds(await timerLabel(page));
  const progress = (await page.locator("header p.text-sm").first().innerText()).trim();
  await shot(page, `${FLOW}-${width}-answered`);
  await page.reload();
  await expect(page.getByText("Opening your exam…")).toBeHidden({ timeout: 30_000 });
  await shot(page, `${FLOW}-${width}-reloaded`);
  const afterProgress = (await page.locator("header p.text-sm").first().innerText()).trim();
  const afterTimer = timerSeconds(await timerLabel(page));
  if (afterProgress !== progress) {
    throw new Error(`Question index changed from "${progress}" to "${afterProgress}".`);
  }
  if (beforeTimer == null || afterTimer == null) {
    throw new Error("The timer did not come back as a clock.");
  }
  if (Math.abs(beforeTimer - afterTimer) > 20) {
    throw new Error(`Timer jumped from ${beforeTimer}s to ${afterTimer}s.`);
  }
  for (const saved of answered) {
    const value = await readAnswerAt(page, saved.index);
    if (value !== saved.value) {
      throw new Error(`Question ${saved.index} ${saved.kind} came back as "${value}", expected "${saved.value}".`);
    }
  }
  if (full) {
    await page.goBack();
    await page.waitForTimeout(400);
    if (!page.url().includes("/session/")) throw new Error("Back left the exam.");
    await expect(page.getByText("Exam submitted")).toHaveCount(0);
    await shot(page, `${FLOW}-${width}-back`);
    const second = await otherDevice(browser, link, width);
    await note(FLOW, `${width} other device`, second.includes("another device") ? "pass" : "fail", second);
    if (!second.includes("This exam is already open on another device")) {
      throw new Error(second);
    }
    const dialog = await blankFinishCancel(page);
    await shot(page, `${FLOW}-${width}-finish-cancel`);
    await note(FLOW, `${width} blank finish dialog`, "note", dialog);
    if (!/not answered|Finish now/i.test(dialog)) {
      throw new Error(`Finish dialog did not describe unanswered questions: ${dialog}`);
    }
  }
  const submitted = await finishOrSubmit(page);
  await shot(page, `${FLOW}-${width}-submitted`);
  await page.reload();
  await expect(page.getByText(/Exam submitted|already been submitted/)).toBeVisible();
  if (await page.locator("#numeric-answer, textarea, #fraction-numerator").count()) {
    const enabled = await page.locator("#numeric-answer, textarea, #fraction-numerator").first().isEnabled();
    if (enabled) throw new Error("An answer box was still editable after submit.");
  }
  if (await page.locator('input[type="radio"]:not([disabled])').count()) {
    throw new Error("A choice was still editable after submit.");
  }
  await shot(page, `${FLOW}-${width}-submitted-reload`);
  return `${submitted}; kinds ${answered.map((item) => item.kind).join(",")}`;
}

test("student start, reload, back, second device, and submit", async ({ page, browser }) => {
  const stamp = String(Date.now()).slice(-6);
  const examName = `E2E staging ${stamp}`;
  await signIn(page, staffEmail("admin"), staffPassword("admin"));
  await page.setViewportSize({ width: 1280, height: 900 });

  const ready = await step(FLOW, "create sitting and QR", async () => {
    await page.goto("/admin/schedule");
    const existing = page.getByRole("link", { name: "E2E staging 950001", exact: true });
    let usedName = examName;
    if (await existing.count()) {
      await existing.click();
      usedName = "E2E staging 950001";
    } else {
      await createNamedExam(page, examName);
      await addSittingTime(page, `E2E ${stamp}`, "2034-08-20T14:00", "2034-08-20T17:00");
      await prepareSitting(page);
    }
    if (await page.getByRole("button", { name: "Prepare questions" }).count()) {
      await prepareSitting(page);
    }
    await shot(page, `${FLOW}-prepared`);
    await page.locator("#codes").scrollIntoViewIfNeeded();
    const issued = await issueOneCode(page);
    await shot(page, `${FLOW}-qr-created`);
    await writeState({
      examName: usedName,
      scheduleUrl: page.url(),
      student1024: issued.student,
      link1024: issued.link,
    });
    return `student selected; one QR link decoded`;
  });
  expect(ready).toBeTruthy();

  const state = await readState();
  await step(FLOW, "1024 exam flow", async () => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 900 },
      timezoneId: "Asia/Hong_Kong",
      recordVideo: { dir: "/tmp/staging-e2e-video", size: { width: 1024, height: 900 } },
    });
    const exam = await context.newPage();
    const video = exam.video();
    let failure: unknown = null;
    let result = "";
    try {
      result = await runWidth(exam, browser, state.link1024!, 1024, true);
    } catch (error) {
      failure = error;
    } finally {
      await context.close();
      const src = await video?.path().catch(() => "");
      if (src) {
        const { copyFile } = await import("node:fs/promises");
        await copyFile(src, "/cursor/stores/bc-92314f63-d670-4644-be86-ba5aeb6af75c/media/staging-e2e/02-student-exam-1024.webm").catch(() => undefined);
      }
    }
    if (failure) throw failure;
    return result;
  });

  for (const width of [375, 768]) {
    await step(FLOW, `${width} start reload submit`, async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(state.scheduleUrl!);
      const issued = await issueOneCode(page);
      await writeState({ [`student${width}`]: issued.student, [`link${width}`]: issued.link });
      const context = await browser.newContext({
        viewport: { width, height: width === 375 ? 800 : 900 },
        timezoneId: "Asia/Hong_Kong",
        recordVideo: {
          dir: "/tmp/staging-e2e-video",
          size: { width, height: width === 375 ? 800 : 900 },
        },
      });
      const exam = await context.newPage();
      const video = exam.video();
      let failure: unknown = null;
      let result = "";
      try {
        result = await runWidth(exam, browser, issued.link, width, false);
      } catch (error) {
        failure = error;
      } finally {
        await context.close();
        const src = await video?.path().catch(() => "");
        if (src) {
          const { copyFile } = await import("node:fs/promises");
          await copyFile(src, `/cursor/stores/bc-92314f63-d670-4644-be86-ba5aeb6af75c/media/staging-e2e/02-student-exam-${width}.webm`).catch(() => undefined);
        }
      }
      if (failure) throw failure;
      return result;
    });
  }
});
