import { expect, test, type Page } from "@playwright/test";

import { signIn, staffEmail, staffPassword } from "../src/auth";
import { note, saveVideo, shot, step } from "../src/media";

const FLOW = "04-admin-language";

const PAGES = [
  "/admin",
  "/admin/bank",
  "/admin/bank/Math",
  "/admin/bank/Chinese",
  "/admin/settings",
  "/admin/schedule",
  "/admin/exams",
  "/admin/exams/new",
  "/admin/students",
  "/admin/students/import",
  "/admin/review",
  "/admin/questions",
  "/admin/questions/new",
  "/admin/questions/import",
  "/admin/advanced",
];

test.use({ viewport: { width: 1280, height: 900 } });

test.afterEach(async ({ page }, info) => {
  await saveVideo(page, info, "04-admin-language");
});

async function overflow(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const wide = root.scrollWidth > root.clientWidth + 2;
    const offenders: string[] = [];
    if (wide) offenders.push(`document ${root.scrollWidth}>${root.clientWidth}`);
    for (const element of document.querySelectorAll("main, table, h1, nav")) {
      const box = element.getBoundingClientRect();
      if (box.right > root.clientWidth + 8) {
        offenders.push(`${element.tagName}.${(element as HTMLElement).className}`.slice(0, 80));
      }
    }
    return offenders.join("; ") || "none";
  });
}

test("themes, languages, size, and the settings panel", async ({ page, context }) => {
  await signIn(page, staffEmail("admin"), staffPassword("admin"));
  await shot(page, `${FLOW}-settings-closed`);

  await step(FLOW, "settings panel hover, escape, outside click, and tab", async () => {
    const trigger = page.getByRole("button", { name: "Settings" });
    const panel = page.locator("#settings-panel");
    await trigger.hover();
    await page.waitForTimeout(400);
    const openedByHover = await panel.isVisible();
    await note(FLOW, "settings hover", openedByHover ? "pass" : "fail", openedByHover ? "Hover opened the panel." : "Hover did not open the panel.");
    if (!openedByHover) await trigger.click();
    await expect(panel).toBeVisible();
    await shot(page, `${FLOW}-settings-hover-open`);
    await page.mouse.move(8, 8);
    await page.waitForTimeout(500);
    const closedByLeave = !(await panel.isVisible());
    await note(FLOW, "settings leave", closedByLeave ? "pass" : "fail", closedByLeave ? "Leaving closed the panel." : "The panel stayed open after the pointer left.");
    if (!closedByLeave) await page.keyboard.press("Escape");

    await trigger.hover();
    await page.waitForTimeout(300);
    if (!(await panel.isVisible())) await trigger.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    if (!(await panel.isVisible())) await trigger.click();
    await expect(panel).toBeVisible();
    await page.mouse.click(20, 400);
    await expect(panel).toBeHidden();

    await trigger.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const active = document.activeElement;
      const panelNode = document.getElementById("settings-panel");
      return Boolean(active && panelNode && (panelNode === active || panelNode.contains(active)));
    });
    await shot(page, `${FLOW}-settings-tab`);
    if (!focused) throw new Error("Tab did not move into the settings panel.");
    return "hover, leave, escape, outside click, and tab behaved";
  });

  const findings: string[] = [];
  for (const locale of ["en", "zh-Hant"] as const) {
    for (const theme of ["dark", "light-contrast"] as const) {
      for (const size of [50, 100, 200] as const) {
        await context.addCookies([
          {
            name: "mcq-prefs",
            value: `${locale}.${theme}.${size}`,
            url: "http://127.0.0.1:3000",
          },
        ]);
        for (const route of PAGES) {
          const response = await page.goto(route);
          const status = response?.status() ?? 0;
          const slug = route.replace(/\//g, "_").replace(/^_/, "") || "home";
          await shot(page, `${FLOW}-${slug}__${locale}__${theme}__${size}`);
          const problem = await overflow(page);
          if (status >= 400 || problem !== "none") {
            findings.push(`${route} ${locale} ${theme} ${size}% status ${status} overflow ${problem}`);
          }
          if (locale === "zh-Hant") {
            const english = await page.evaluate(() => {
              const root = document.querySelector("main");
              if (!root) return [];
              const text = root.innerText.split("\n").map((line) => line.trim()).filter((line) => line.length > 18);
              return text
                .filter((line) => {
                  const letters = line.match(/[A-Za-z]/g)?.length ?? 0;
                  return letters > 12 && letters / line.length > 0.55;
                })
                .slice(0, 8);
            });
            if (english.length) {
              findings.push(`${route} ${theme} ${size}% english: ${english.join(" | ")}`);
            }
          }
        }
      }
    }
  }
  await note(FLOW, "walk findings", findings.length ? "fail" : "pass", findings.join("\n") || "No overflow or leftover English sentences.");
  if (findings.length) {
    await note(FLOW, "walk count", "note", `${findings.length} notes`);
  }
});
