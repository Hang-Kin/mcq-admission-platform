import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { signIn, staffEmail, staffPassword } from "../src/auth";
import {
  answerCurrent,
  createNamedExam,
  finishOrSubmit,
  openExam,
  readAnswerAt,
  timerLabel,
  type AnswerSnap,
} from "../src/examFlow";
import { MEDIA_DIR, note, saveVideo, shot, step } from "../src/media";
import { assertStagingHost, stagingAnonKey } from "../src/guard";
import {
  accessToken,
  addTime,
  answerExact,
  bodyText,
  currentAnswerText,
  hongKongLocal,
  issueCode,
  keepSpaces,
  plain,
  prepareCard,
  redact,
  selectExam,
  selectSeedIntake,
  showQuestion,
} from "../src/part2Flow";
import {
  STAFF_RPCS,
  TABLES,
  callRpc,
  readTable,
  signInWithPassword,
  summarize,
} from "../src/rpc";

const FLOW = "06-part2";
const TEXT_EXACT = "Hong Kong";
const TEXT_VARIED = "  hONG   KONG  ";
const VIDEO_DIR = "/tmp/staging-e2e-part2-video";

test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(45 * 60 * 1000);

test.afterEach(async ({ page }, info) => {
  await saveVideo(page, info, "06-part2-admin");
});

function pendingSecrets(): { email: string; password: string } | null {
  const email = process.env.STAGING_PENDING_EMAIL?.trim() ?? "";
  const password = process.env.STAGING_PENDING_PASSWORD?.trim() ?? "";
  if (!email || !password) return null;
  return { email, password };
}

async function examContext(browser: Browser, width = 1024): Promise<{ context: BrowserContext; page: Page }> {
  await mkdir(VIDEO_DIR, { recursive: true });
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    timezoneId: "Asia/Hong_Kong",
    locale: "en-HK",
    recordVideo: { dir: VIDEO_DIR, size: { width, height: 900 } },
  });
  const page = await context.newPage();
  return { context, page };
}

async function keepVideo(page: Page, name: string) {
  const video = page.video();
  await page.context().close().catch(() => undefined);
  const src = await video?.path().catch(() => "");
  if (!src) return "";
  const { copyFile } = await import("node:fs/promises");
  const dest = path.join(MEDIA_DIR, `${name}.webm`);
  await copyFile(src, dest);
  return dest;
}

async function signInAdmin(page: Page) {
  await page.context().clearCookies();
  await signIn(page, staffEmail("admin"), staffPassword("admin"));
}

async function restoreEight(page: Page) {
  await page.goto("/admin/settings");
  if (await page.locator("#email").count()) {
    await signIn(page, staffEmail("admin"), staffPassword("admin"));
    await page.goto("/admin/settings");
  }
  await page.locator("#Math-minutes").fill("8");
  await page.locator("#Chinese-minutes").fill("8");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const math = await page.locator("#Math-minutes").inputValue();
  const chinese = await page.locator("#Chinese-minutes").inputValue();
  await shot(page, `${FLOW}-minutes-restored`);
  if (math !== "8" || chinese !== "8") {
    throw new Error(`Minutes after restore were Math ${math}, Chinese ${chinese}.`);
  }
  return `Math ${math}, Chinese ${chinese}`;
}

async function addBankQuestion(
  page: Page,
  topicHref: string,
  kind: "number" | "fraction" | "text",
  question: string,
  answer: string,
) {
  await page.goto(`${topicHref}/new`);
  await page.locator("form").last().locator("textarea").fill(question);
  await page.locator("#answer_kind").selectOption(kind);
  if (kind === "number") await page.locator("#number_answer").fill(answer);
  if (kind === "fraction") {
    const [numerator, denominator] = answer.split("/");
    await page.locator("#fraction_a").fill(numerator ?? "");
    await page.locator("#fraction_b").fill(denominator ?? "");
  }
  if (kind === "text") await page.locator("#written_answer").fill(answer);
  await page.getByRole("button", { name: "Save question" }).click();
  await expect(page.locator("form").last().locator("textarea")).toHaveValue("");
  await expect(page.getByText("Question saved.")).toBeVisible();
}

async function questionId(page: Page, topicHref: string, question: string): Promise<string> {
  await page.goto(topicHref);
  const row = page.locator("li").filter({ hasText: question }).first();
  await expect(row).toBeVisible();
  const href = await row.getByRole("link", { name: "Edit" }).getAttribute("href");
  const match = /\/([0-9a-f-]{36})\/edit$/.exec(href ?? "");
  if (!match) throw new Error(`No edit link for ${question}.`);
  return match[1]!;
}

async function openReviewPaper(page: Page, examName: string, studentName: string) {
  await page.goto("/admin/review");
  const heading = page.getByRole("heading", { name: examName, level: 3 });
  await expect(heading).toBeVisible();
  const block = heading.locator("xpath=ancestor::div[1]");
  const link = block.getByRole("link", { name: studentName, exact: false }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("button", { name: /Confirm all/ })).toBeVisible();
}

async function cardText(page: Page, snippet: string): Promise<string> {
  const card = page.locator("ol > li").filter({ hasText: snippet }).first();
  await expect(card).toBeVisible();
  const answer = await card.locator("p.whitespace-pre-wrap").first().evaluate((node) => node.textContent ?? "");
  const visible = plain(await card.innerText());
  return `answer=[${keepSpaces(answer)}] card=${visible.slice(0, 500)}`;
}

test("lane G staging checks", async ({ page, browser }) => {
  assertStagingHost();
  let minutesShortened = false;

  await step(FLOW, "1 pending account", async () => {
    const pending = pendingSecrets();
    if (!pending) {
      await note(
        FLOW,
        "1 pending skipped",
        "note",
        "STAGING_PENDING_EMAIL and STAGING_PENDING_PASSWORD are missing. The pending-account test was skipped. No account was signed up through the app.",
      );
      return "skipped: STAGING_PENDING_EMAIL and STAGING_PENDING_PASSWORD are missing";
    }
    await page.goto("/auth/login");
    await page.locator("#email").fill(pending.email);
    await page.locator("#password").fill(pending.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForLoadState("networkidle");
    const alert = page.getByRole("alert");
    if (await alert.count()) throw new Error(redact(await alert.innerText()));
    await shot(page, `${FLOW}-pending-after-login`);
    if (page.url().includes("/admin")) throw new Error("Pending account opened /admin after sign-in.");
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await shot(page, `${FLOW}-pending-admin-blocked`);
    if (page.url().includes("/admin") && !page.url().includes("/auth")) {
      throw new Error("Pending account stayed on /admin.");
    }
    const landed = page.url().replace(/\?.*/, "");
    const session = await signInWithPassword(pending.email, pending.password);
    if (!session.accessToken) throw new Error(`Pending token failed: ${redact(session.error ?? "")}`);
    const lines = [`landed ${landed.replace(/https?:\/\/[^/]+/, "")}`];
    for (const table of TABLES) {
      const result = await readTable(table, session.accessToken);
      const summary = summarize(result);
      lines.push(`${table} ${summary}`);
      if (Array.isArray(result.body) && result.body.length > 0) {
        throw new Error(`${table} returned a row. ${summary}`);
      }
    }
    const rpcs = [
      ...STAFF_RPCS,
      { name: "set_user_role", args: { p_user_id: session.userId, p_role: "teacher" } },
    ];
    for (const rpc of rpcs) {
      const result = await callRpc(rpc.name, rpc.args, session.accessToken);
      const summary = redact(summarize(result));
      lines.push(`${rpc.name} ${summary}`);
      const blob = JSON.stringify(result.body);
      const blocked = result.status >= 400 || /not_staff|permission|denied|error|PGRST/i.test(blob);
      if (!blocked) throw new Error(`${rpc.name} was not refused: ${summary}`);
    }
    return lines.join("\n");
  });

  await step(FLOW, "2 teacher add edit delete", async () => {
    const stamp = String(Date.now());
    await page.context().clearCookies();
    await signIn(page, staffEmail("teacher"), staffPassword("teacher"));
    const topic = `Gteach${stamp}`;
    const text = `E2E teacher choice ${stamp}`;
    await page.goto("/admin/bank/Math");
    await page.locator("#topic-name").fill(topic);
    await page.getByRole("button", { name: "Add a topic" }).click();
    await expect(page.getByRole("heading", { name: topic })).toBeVisible();
    const href = page.url().split("?")[0]!;
    await page.goto(`${href}/new`);
    await page.locator("#question_text").fill(text);
    await page.locator("#answer_kind").selectOption("choice");
    const choices = page.locator('input[placeholder^="Choice "]');
    await choices.nth(0).fill("red");
    await choices.nth(1).fill("blue");
    await page.getByRole("button", { name: "Save question" }).click();
    await expect(page.getByText("Question saved.")).toBeVisible();
    await shot(page, `${FLOW}-teacher-added`);
    await page.goto(href);
    const row = page.locator("li").filter({ hasText: text });
    await row.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/edit/);
    await page.locator("#question_text").fill(`${text} edited`);
    await page.getByRole("button", { name: "Save question" }).click();
    await expect(page.getByText(`${text} edited`).first()).toBeVisible();
    await shot(page, `${FLOW}-teacher-edited`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("li").filter({ hasText: `${text} edited` }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("button", { name: /Deleting/ })).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText("No questions in this topic yet.").first()).toBeVisible({ timeout: 20_000 });
    await shot(page, `${FLOW}-teacher-deleted`);
    return "added, edited, and deleted";
  });

  await step(FLOW, "2 teacher set_user_role refused", async () => {
    const session = await signInWithPassword(staffEmail("teacher"), staffPassword("teacher"));
    if (!session.accessToken || !session.userId) {
      throw new Error(`Teacher token failed: ${redact(session.error ?? "")}`);
    }
    const result = await callRpc(
      "set_user_role",
      { new_role: "admin", target_user: session.userId },
      session.accessToken,
    );
    const summary = redact(summarize(result));
    const blob = JSON.stringify(result.body);
    if (result.status < 400 && /"ok"\s*:\s*true/.test(blob)) {
      throw new Error(`set_user_role succeeded: ${summary}`);
    }
    if (result.status < 400 && !/only admins|not_|permission|denied|error/i.test(blob)) {
      throw new Error(`set_user_role was not refused: ${summary}`);
    }
    return `set_user_role(new_role, target_user) ${summary}`;
  });

  const stamp = String(Date.now()).slice(-8);
  const topics = {
    fraction: `Gfrac${stamp}`,
    numeric: `Gnum${stamp}`,
    text: `Gtext${stamp}`,
  };
  const questions = {
    fraction: `E2E fraction ${stamp}`,
    numeric: `E2E numeric ${stamp}`,
    text: `E2E written ${stamp}`,
    blank: `E2E blank written ${stamp}`,
  };
  const ids: Record<string, string> = {};
  let examName = "";
  let paperA = "";
  let paperB = "";

  await step(FLOW, "3 create fraction numeric and text questions", async () => {
    await signInAdmin(page);
    await page.goto("/admin/settings");
    const per = Number(await page.locator("#Math-questions").inputValue());
    const mathMinutes = await page.locator("#Math-minutes").inputValue();
    const chineseMinutes = await page.locator("#Chinese-minutes").inputValue();
    await note(FLOW, "subject settings before item 5", "note", `Math ${mathMinutes} min, Chinese ${chineseMinutes} min, ${per} per topic`);
    if (!Number.isInteger(per) || per < 1) throw new Error(`Questions per topic was ${per}.`);
    for (const [kind, topic] of Object.entries(topics) as Array<[keyof typeof topics, string]>) {
      await page.goto("/admin/bank/Math");
      await page.locator("#topic-name").fill(topic);
      await page.getByRole("button", { name: "Add a topic" }).click();
      await expect(page.getByRole("heading", { name: topic })).toBeVisible();
      const href = page.url().split("?")[0]!;
      if (kind === "fraction") {
        await addBankQuestion(page, href, "fraction", questions.fraction, "1/2");
        for (let index = 2; index <= per; index += 1) {
          await addBankQuestion(page, href, "fraction", `E2E fraction filler ${stamp} ${index}`, "1/2");
        }
      } else if (kind === "numeric") {
        await addBankQuestion(page, href, "number", questions.numeric, "4");
        for (let index = 2; index <= per; index += 1) {
          await addBankQuestion(page, href, "number", `E2E numeric filler ${stamp} ${index}`, "4");
        }
      } else {
        await addBankQuestion(page, href, "text", questions.text, TEXT_EXACT);
        if (per >= 2) await addBankQuestion(page, href, "text", questions.blank, "");
        for (let index = 3; index <= per; index += 1) {
          await addBankQuestion(page, href, "text", `E2E written filler ${stamp} ${index}`, "Sample");
        }
      }
    }
    const fractionHref = `/admin/bank/Math/${encodeURIComponent(topics.fraction)}`;
    const numericHref = `/admin/bank/Math/${encodeURIComponent(topics.numeric)}`;
    const textHref = `/admin/bank/Math/${encodeURIComponent(topics.text)}`;
    ids.fraction = await questionId(page, fractionHref, questions.fraction);
    ids.numeric = await questionId(page, numericHref, questions.numeric);
    ids.text = await questionId(page, textHref, questions.text);
    if (per >= 2) ids.blank = await questionId(page, textHref, questions.blank);
    else {
      const blankTopic = `Gblank${stamp}`;
      await page.goto("/admin/bank/Math");
      await page.locator("#topic-name").fill(blankTopic);
      await page.getByRole("button", { name: "Add a topic" }).click();
      await expect(page.getByRole("heading", { name: blankTopic })).toBeVisible();
      const blankHref = page.url().split("?")[0]!;
      await addBankQuestion(page, blankHref, "text", questions.blank, "");
      ids.blank = await questionId(page, blankHref, questions.blank);
    }
    await shot(page, `${FLOW}-questions-created`);
    return `per topic ${per}; fraction ${ids.fraction}; numeric ${ids.numeric}; text ${ids.text}; blank ${ids.blank}`;
  });

  await step(FLOW, "3 submit two papers", async () => {
    if (!ids.text) throw new Error("Text question was not created.");
    examName = `E2E part2 ${stamp}`;
    await createNamedExam(page, examName);
    await selectExam(page, examName);
    await addTime(page, `Slot ${stamp}`, "2036-06-02T09:00", "2036-06-02T12:00");
    await prepareCard(page, `Slot ${stamp}`);
    await selectSeedIntake(page);
    const first = await issueCode(page);
    paperA = first.name;
    await page.reload();
    const second = await issueCode(page, { excludeName: first.name });
    paperB = second.name;
    await shot(page, `${FLOW}-papers-issued`);
    const runs = [
      { link: first.link, text: TEXT_EXACT, video: `${FLOW}-paper-exact` },
      { link: second.link, text: TEXT_VARIED, video: `${FLOW}-paper-varied` },
    ];
    for (const run of runs) {
      const opened = await examContext(browser);
      try {
        await openExam(opened.page, run.link);
        await showQuestion(opened.page, questions.fraction);
        await answerExact(opened.page, "fraction", "1/2");
        await showQuestion(opened.page, questions.numeric);
        await answerExact(opened.page, "numeric", "4");
        await showQuestion(opened.page, questions.text);
        await answerExact(opened.page, "text", run.text);
        await showQuestion(opened.page, questions.blank);
        await answerExact(opened.page, "text", "needs a person");
        await shot(opened.page, `${run.video}-answered`);
        await finishOrSubmit(opened.page);
        await shot(opened.page, `${run.video}-submitted`);
      } finally {
        await keepVideo(opened.page, run.video);
      }
    }
    return `papers for two students submitted`;
  });

  await step(FLOW, "3f text marks before regrade", async () => {
    const lines: string[] = [];
    for (const [label, name, sample] of [
      ["exact", paperA, TEXT_EXACT],
      ["varied", paperB, TEXT_VARIED],
    ] as const) {
      await openReviewPaper(page, examName, name);
      lines.push(`${label} typed [${keepSpaces(sample)}]`);
      lines.push(await cardText(page, questions.text));
      lines.push(`blank ${await cardText(page, questions.blank)}`);
      await shot(page, `${FLOW}-text-before-${label}`);
    }
    return lines.join("\n");
  });

  await step(FLOW, "3a confirm one", async () => {
    await openReviewPaper(page, examName, paperA);
    const card = page.locator("ol > li").filter({ hasText: questions.numeric }).first();
    await card.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(card.getByText(/Confirmed by/)).toBeVisible();
    await shot(page, `${FLOW}-confirm-one`);
    return plain(await card.innerText()).slice(0, 400);
  });

  await step(FLOW, "3b edit one to incorrect", async () => {
    const card = page.locator("ol > li").filter({ hasText: questions.fraction }).first();
    await card.getByRole("button", { name: "Edit", exact: true }).click();
    await card.getByRole("radio", { name: "Incorrect" }).check();
    await card.locator("textarea[name='note']").fill("E2E part2 override");
    await card.getByRole("button", { name: "Save edit" }).click();
    const appeared = await card.getByText(/Overridden by/).waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
    await shot(page, `${FLOW}-overridden`);
    const text = plain(await card.innerText());
    if (!appeared) {
      await page.reload();
      const again = plain(await page.locator("ol > li").filter({ hasText: questions.fraction }).first().innerText());
      throw new Error(`Overridden by did not appear within 20s. Before reload: ${text.slice(0, 300)} After reload: ${again.slice(0, 300)}`);
    }
    return text.slice(0, 400);
  });

  await step(FLOW, "4 ungraded confirm message", async () => {
    const card = page.locator("ol > li").filter({ hasText: questions.blank }).first();
    if (!(await card.count())) return "The blank written question was not on this paper.";
    const before = plain(await card.innerText());
    await card.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(card.getByText("Saving…")).toBeHidden({ timeout: 20_000 });
    const after = plain(await card.innerText());
    await shot(page, `${FLOW}-ungraded-confirm`);
    return `before: ${before.slice(0, 350)}\nafter: ${after.slice(0, 500)}`;
  });

  await step(FLOW, "4 confirm all current behaviour", async () => {
    const button = page.getByRole("button", { name: /Confirm all/ });
    const before = plain(await button.innerText());
    await button.click();
    await page.waitForTimeout(1200);
    const region = plain(await page.locator("main").last().innerText());
    await shot(page, `${FLOW}-confirm-all`);
    const skipped = /skip/i.test(region);
    return `Lane F is not merged. Button was "${before}". Skipped sentence visible: ${skipped}. Page: ${region.slice(0, 700)}`;
  });

  async function regrade(kind: "fraction" | "numeric" | "text", before: string) {
    const id = ids[kind];
    if (!id) throw new Error(`Missing ${kind} id.`);
    await page.goto(`/admin/bank/Math/${encodeURIComponent(topics[kind])}/${id}/edit`);
    if (kind === "fraction") {
      await page.locator("#fraction_a").fill("3");
      await page.locator("#fraction_b").fill("4");
    } else if (kind === "numeric") {
      await page.locator("#number_answer").fill("9");
    } else {
      await page.locator("#written_answer").fill("Macau");
    }
    await page.getByRole("button", { name: "Save question" }).click();
    await expect(page).not.toHaveURL(/\/edit/, { timeout: 20_000 });
    if (kind !== "text") {
      const savedAnswer = kind === "fraction" ? "3/4" : "9";
      await expect(page.getByText(savedAnswer).first()).toBeVisible();
    }
    await page.goto(`/admin/review/regrade/${id}?edited=1&before=${encodeURIComponent(before)}`);
    await expect(page.getByRole("heading", { name: "Regrade affected students" })).toBeVisible();
    const preview = plain(await page.locator("main").innerText());
    await shot(page, `${FLOW}-regrade-${kind}`);
    const apply = page.getByRole("button", { name: "Regrade affected students" });
    if (await apply.isEnabled()) {
      await apply.click();
      await expect(page.getByText(/Regrade saved/)).toBeVisible({ timeout: 30_000 });
    }
    const after = plain(await page.locator("main").innerText());
    await shot(page, `${FLOW}-regrade-${kind}-applied`);
    return `${kind} preview: ${preview.slice(0, 450)}\n${kind} after: ${after.slice(0, 350)}`;
  }

  await step(FLOW, "3c regrade each question type", async () => {
    const fraction = await regrade("fraction", "1/2");
    const numeric = await regrade("numeric", "4");
    const text = await regrade("text", TEXT_EXACT);
    return [fraction, numeric, text].join("\n");
  });

  await step(FLOW, "3d 3e override kept and regrade log", async () => {
    await openReviewPaper(page, examName, paperA);
    const card = page.locator("ol > li").filter({ hasText: questions.fraction }).first();
    const text = plain(await card.innerText());
    await shot(page, `${FLOW}-override-after-regrade`);
    const kept = /Overridden by/.test(text) && /E2E part2 override/.test(text);
    const token = accessToken(await page.context().cookies());
    if (!token) throw new Error("Could not read the staff session.");
    const log = await fetch(
      `${assertStagingHost()}/rest/v1/regrade_log?select=question_id,changed_count,preserved_override_count&question_id=in.(${ids.fraction},${ids.numeric},${ids.text})`,
      { headers: { apikey: stagingAnonKey(), Authorization: `Bearer ${token}` } },
    );
    const logBody = await log.text();
    if (!kept) throw new Error(`Override was not kept. ${text.slice(0, 400)}`);
    if (!log.ok) throw new Error(`regrade_log HTTP ${log.status} ${redact(logBody).slice(0, 240)}`);
    return `override kept. regrade_log HTTP ${log.status} ${redact(logBody).slice(0, 500)}`;
  });

  await step(FLOW, "3f text marks after regrade", async () => {
    const lines: string[] = [];
    for (const [label, name] of [
      ["exact", paperA],
      ["varied", paperB],
    ] as const) {
      await openReviewPaper(page, examName, name);
      lines.push(`${label} ${await cardText(page, questions.text)}`);
      await shot(page, `${FLOW}-text-after-${label}`);
    }
    const exactBefore = "Hong Kong compared with lower(trim())";
    lines.push(`comparison note: ${exactBefore}; varied sample keeps internal spaces`);
    return lines.join("\n");
  });

  await step(FLOW, "6 replaced QR", async () => {
    const name = `E2E replace ${stamp}`;
    await createNamedExam(page, name);
    await selectExam(page, name);
    await addTime(page, `Replace ${stamp}`, "2036-07-02T09:00", "2036-07-02T12:00");
    await prepareCard(page, `Replace ${stamp}`);
    await selectSeedIntake(page);
    const first = await issueCode(page);
    await page.reload();
    const second = await issueCode(page, { preferName: first.name });
    const oldPage = await browser.newPage();
    await oldPage.goto(first.link);
    await expect(oldPage.getByText(/Opening your exam|This link is invalid|This /)).toBeVisible();
    await expect(oldPage.getByText("Opening your exam…")).toBeHidden({ timeout: 30_000 });
    const oldText = await bodyText(oldPage);
    await shot(oldPage, `${FLOW}-qr-old`);
    await oldPage.close();
    const fresh = await examContext(browser);
    let newText = "";
    try {
      await openExam(fresh.page, second.link);
      newText = await bodyText(fresh.page, 300);
      await shot(fresh.page, `${FLOW}-qr-new`);
    } finally {
      await keepVideo(fresh.page, `${FLOW}-qr-new`);
    }
    return `old: ${oldText.slice(0, 300)}\nnew: ${newText.slice(0, 300)}`;
  });

  await step(FLOW, "8 resume then 7 offline and mid-save", async () => {
    const name = `E2E resume ${stamp}`;
    await createNamedExam(page, name);
    await selectExam(page, name);
    await addTime(page, `Resume ${stamp}`, "2036-08-02T09:00", "2036-08-02T12:00");
    await prepareCard(page, `Resume ${stamp}`);
    await selectSeedIntake(page);
    const issued = await issueCode(page);
    const opened = await examContext(browser);
    const lines: string[] = [];
    let offlineReport = "";
    try {
      await openExam(opened.page, issued.link);
      const answered: AnswerSnap[] = [];
      for (let count = 0; count < 5; count += 1) {
        try {
          answered.push(await answerCurrent(opened.page));
        } catch (error) {
          lines.push(`stopped after ${answered.length}: ${error instanceof Error ? error.message : error}`);
          break;
        }
        const next = opened.page.locator("footer").getByRole("button", { name: "Next" }).last();
        if ((await next.count()) > 0 && (await next.isEnabled())) await next.click();
      }
      await shot(opened.page, `${FLOW}-resume-before`);
      await opened.page.reload();
      await expect(opened.page.getByText("Opening your exam…")).toBeHidden({ timeout: 30_000 });
      await shot(opened.page, `${FLOW}-resume-after`);
      for (const saved of answered) {
        const value = await readAnswerAt(opened.page, saved.index);
        lines.push(`q${saved.index} ${saved.kind} before [${saved.value}] after [${value}] ${value === saved.value ? "match" : "DIFFER"}`);
      }
      const savedFirst = await currentAnswerText(opened.page);
      await opened.context.setOffline(true);
      const buttons = opened.page.locator("header nav button");
      if ((await buttons.count()) > 1) await buttons.nth(1).click();
      if (await opened.page.locator("#numeric-answer").count()) {
        await opened.page.locator("#numeric-answer").fill("8");
      } else if (await opened.page.locator("#fraction-numerator").count()) {
        await opened.page.locator("#fraction-numerator").fill("3");
        await opened.page.locator("#fraction-denominator").fill("5");
      } else if (await opened.page.locator('input[type="radio"]').count()) {
        const radios = opened.page.locator('input[type="radio"]');
        if ((await radios.count()) > 1) await radios.nth(1).check();
        else await radios.first().check();
      } else if (await opened.page.locator("#text-answer").count()) {
        await opened.page.locator("#text-answer").fill("offline answer");
      }
      await opened.page.waitForTimeout(10_000);
      const offlineText = await bodyText(opened.page, 400);
      const offlineValue = await currentAnswerText(opened.page);
      await shot(opened.page, `${FLOW}-offline`);
      await opened.context.setOffline(false);
      await opened.page.waitForTimeout(1500);
      const onlineValue = await currentAnswerText(opened.page);
      const request = opened.page
        .waitForRequest((item) => item.url().includes("/rpc/submit_answer"), { timeout: 8_000 })
        .catch(() => null);
      if (await opened.page.locator("#numeric-answer").count()) {
        await opened.page.locator("#numeric-answer").fill("7");
      } else if (await opened.page.locator("#fraction-numerator").count()) {
        await opened.page.locator("#fraction-numerator").fill("2");
        await opened.page.locator("#fraction-denominator").fill("7");
      } else if (await opened.page.locator("#text-answer").count()) {
        await opened.page.locator("#text-answer").fill("mid save");
      } else if (await opened.page.locator('input[type="radio"]').count()) {
        await opened.page.locator('input[type="radio"]').first().check();
      }
      await request;
      await opened.page.reload();
      await expect(opened.page.getByText("Opening your exam…")).toBeHidden({ timeout: 30_000 });
      const returned = await currentAnswerText(opened.page);
      await shot(opened.page, `${FLOW}-reload-mid-save`);
      offlineReport = `first field after resume [${savedFirst}]. Offline 10s message: ${offlineText}. Offline field [${offlineValue}]. After reconnect field [${onlineValue}]. After reload mid-save [${returned}].`;
    } finally {
      await opened.context.setOffline(false).catch(() => undefined);
      await keepVideo(opened.page, `${FLOW}-resume`);
    }
    await note(FLOW, "7 offline and reload during save", "note", offlineReport);
    if (lines.some((line) => line.includes("DIFFER") || line.startsWith("stopped"))) {
      throw new Error(`${lines.join("\n")}\n${offlineReport}`);
    }
    return `${lines.join("\n")}\n${offlineReport}`;
  });

  await step(FLOW, "9 roster sample files", async () => {
    const root = path.resolve(__dirname, "../../test-data");
    await page.goto("/admin/students/import");
    await page.locator("#import-intake-year").selectOption("2034");
    await page.locator("#import-intake-month").selectOption("06");
    const lines: string[] = [];
    for (const file of ["roster_clean.xlsx", "roster_extreme.xlsx", "roster_wrong_headers.csv"]) {
      await page.locator("#roster-file").setInputFiles(path.join(root, file));
      await page.waitForTimeout(800);
      const preview = page.locator("p").filter({ hasText: /to add,|The file needs a column|The file has no|larger than 5 MB/ }).first();
      const text = (await preview.count()) ? plain(await preview.innerText()) : await bodyText(page, 400);
      lines.push(`${file}: ${text}`);
      await shot(page, `${FLOW}-roster-${file.replace(/\..*$/, "")}`);
    }
    const huge = Buffer.alloc(5_000_001, "a");
    const hugePath = "/tmp/staging-e2e-part2-huge.csv";
    await writeFile(hugePath, huge);
    await page.locator("#roster-file").setInputFiles(hugePath);
    await expect(page.getByText("The file is larger than 5 MB.")).toBeVisible();
    lines.push("huge: The file is larger than 5 MB.");
    await shot(page, `${FLOW}-roster-huge`);
    return lines.join("\n");
  });

  await step(FLOW, "10 slot equal to the exam", async () => {
    const name = `E2E length ${stamp}`;
    await createNamedExam(page, name);
    await selectExam(page, name);
    const needs = /This exam needs (\d+) minutes?/.exec(await page.locator("main").innerText());
    if (!needs) throw new Error("The page did not say how many minutes the exam needs.");
    const minutes = Number(needs[1]);
    const start = new Date();
    const end = new Date(start.getTime() + minutes * 60_000);
    await addTime(page, `Length ${stamp}`, hongKongLocal(start), hongKongLocal(end));
    await prepareCard(page, `Length ${stamp}`);
    await selectSeedIntake(page);
    const first = await issueCode(page);
    await page.reload();
    const second = await issueCode(page, { excludeName: first.name });
    const studentA = await examContext(browser);
    let studentB: Awaited<ReturnType<typeof examContext>> | null = null;
    let report = "";
    const openedAt = Date.now();
    try {
      await openExam(studentA.page, first.link);
      const firstTimer = await timerLabel(studentA.page);
      await shot(studentA.page, `${FLOW}-slot-first`);
      const elapsed = Date.now() - openedAt;
      if (elapsed < 4 * 60 * 1000) await page.waitForTimeout(4 * 60 * 1000 - elapsed);
      studentB = await examContext(browser);
      await openExam(studentB.page, second.link);
      const secondTimer = await timerLabel(studentB.page);
      await shot(studentB.page, `${FLOW}-slot-second`);
      const gapSeconds = Math.round((Date.now() - openedAt) / 1000);
      report = `Exam needs ${minutes} minutes. First timer ${firstTimer}. Second timer ${secondTimer}. Gap ${gapSeconds}s.`;
    } finally {
      if (studentB) await keepVideo(studentB.page, `${FLOW}-slot-second`);
      await keepVideo(studentA.page, `${FLOW}-slot-first`);
    }
    return report;
  });

  try {
    minutesShortened = true;
    await step(FLOW, "5 timer reaches zero", async () => {
      await page.goto("/admin/settings");
      await page.locator("#Math-minutes").fill("1");
      await page.locator("#Chinese-minutes").fill("1");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();
      await shot(page, `${FLOW}-minutes-one`);
      const name = `E2E timer ${stamp}`;
      await createNamedExam(page, name);
      await selectExam(page, name);
      await addTime(page, `Timer ${stamp}`, "2036-09-02T09:00", "2036-09-02T09:30");
      await prepareCard(page, `Timer ${stamp}`);
      await selectSeedIntake(page);
      const issued = await issueCode(page);
      const opened = await examContext(browser);
      let answered = "";
      try {
        await openExam(opened.page, issued.link);
        const started = await timerLabel(opened.page);
        await shot(opened.page, `${FLOW}-timer-open`);
        const snap = await answerCurrent(opened.page);
        answered = `q${snap.index} ${snap.kind} [${snap.value}]`;
        await expect(opened.page.getByText(/Exam submitted|already been submitted|section is already finished/)).toBeVisible({
          timeout: 180_000,
        });
        const atZero = await bodyText(opened.page, 600);
        await shot(opened.page, `${FLOW}-timer-zero`);
        await opened.page.reload();
        await opened.page.waitForTimeout(1000);
        const reloaded = await bodyText(opened.page, 400);
        await shot(opened.page, `${FLOW}-timer-reload`);
        await signInAdmin(page);
        await page.goto("/admin/review");
        const heading = page.getByRole("heading", { name, level: 3 });
        let review = "review heading not shown";
        if (await heading.count()) {
          try {
            const row = heading.locator("xpath=following::table[1]").getByRole("link").first();
            await row.click();
            await page.waitForTimeout(800);
            review = plain(await page.locator("main").last().innerText()).slice(0, 900);
          } catch (error) {
            review = `could not open the sitting: ${error instanceof Error ? error.message : error}`.slice(0, 400);
          }
          await shot(page, `${FLOW}-timer-review`);
        }
        return `opened at ${started}; answered ${answered}\nzero: ${atZero}\nreload: ${reloaded}\nreview: ${review}`;
      } finally {
        await keepVideo(opened.page, `${FLOW}-timer`);
      }
    });
  } finally {
    const restored = await step(FLOW, "5 restore minutes to 8 and 8", async () => restoreEight(page));
    if (restored) minutesShortened = false;
    if (minutesShortened) {
      await restoreEight(page);
      minutesShortened = false;
    }
  }
});
