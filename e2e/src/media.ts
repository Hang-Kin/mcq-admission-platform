import { appendFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Page, TestInfo } from "@playwright/test";

import { stagingMediaDir } from "./mediaDir";

export const MEDIA_DIR = stagingMediaDir(process.env.STAGING_E2E_MEDIA);

export const OUTPUT_DIR = path.resolve(__dirname, "../output");
export const STATE_PATH = path.join(OUTPUT_DIR, "state.json");
export const JOURNAL_PATH = path.join(OUTPUT_DIR, "journal.json");

export type JournalEntry = {
  flow: string;
  name: string;
  status: "pass" | "fail" | "note";
  detail: string;
};

type State = Record<string, string>;

export async function ensureDirs() {
  await mkdir(MEDIA_DIR, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
}

export async function readState(): Promise<State> {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8")) as State;
  } catch {
    return {};
  }
}

export async function writeState(patch: State) {
  const current = await readState();
  await writeFile(STATE_PATH, JSON.stringify({ ...current, ...patch }, null, 2));
}

export async function appendJournal(entry: JournalEntry) {
  await ensureDirs();
  let rows: JournalEntry[] = [];
  try {
    rows = JSON.parse(await readFile(JOURNAL_PATH, "utf8")) as JournalEntry[];
  } catch {
    rows = [];
  }
  rows.push(entry);
  await writeFile(JOURNAL_PATH, JSON.stringify(rows, null, 2));
}

/** Hide email addresses in the live DOM, take the shot, then put the text back. */
export async function shot(page: Page, name: string) {
  await ensureDirs();
  const file = path.join(MEDIA_DIR, `${name}.png`);
  await page.evaluate(() => {
    const saved: Array<{ node: Text; value: string }> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const text = current as Text;
      const value = text.nodeValue ?? "";
      if (value.includes("@")) {
        saved.push({ node: text, value });
        text.nodeValue = value.replace(/[^\s@<>]+@[^\s@<>]+/g, "staff@redacted");
      }
      current = walker.nextNode();
    }
    (window as unknown as { __e2eRedact?: typeof saved }).__e2eRedact = saved;
  });
  const tall = await page.evaluate(() => document.documentElement.scrollHeight > 6000);
  let saved = false;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await page.screenshot({ path: file, fullPage: !tall });
      saved = true;
    } catch (error) {
      lastError = error;
      try {
        await page.screenshot({ path: file, fullPage: false });
        saved = true;
      } catch (retryError) {
        lastError = retryError;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }
  if (!saved) throw lastError;
  await page.evaluate(() => {
    const saved = (window as unknown as { __e2eRedact?: Array<{ node: Text; value: string }> })
      .__e2eRedact;
    for (const item of saved ?? []) item.node.nodeValue = item.value;
  });
  return file;
}

export async function saveVideo(page: Page, testInfo: TestInfo, name: string) {
  await ensureDirs();
  const video = page.video();
  if (!video) return "";
  const file = path.join(MEDIA_DIR, `${name}.webm`);
  await video.saveAs(file);
  void testInfo;
  return file;
}

export async function note(flow: string, name: string, status: JournalEntry["status"], detail: string) {
  const clean = detail.replace(/https?:\/\/\S+/g, "[link]").slice(0, 1200);
  await appendJournal({ flow, name, status, detail: clean });
}

export async function step(
  flow: string,
  name: string,
  fn: () => Promise<string | void>,
): Promise<boolean> {
  appendFileSync("/tmp/staging-e2e-trace.log", `${new Date().toISOString()} start ${flow} ${name}\n`);
  try {
    const detail = (await fn()) ?? "ok";
    await note(flow, name, "pass", detail);
    appendFileSync("/tmp/staging-e2e-trace.log", `${new Date().toISOString()} pass ${flow} ${name}\n`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await note(flow, name, "fail", message);
    appendFileSync("/tmp/staging-e2e-trace.log", `${new Date().toISOString()} fail ${flow} ${name} ${message.slice(0, 180).replace(/\n/g, " ")}\n`);
    return false;
  }
}
