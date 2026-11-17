import { defineConfig } from "@playwright/test";

import { assertStagingHost } from "./src/guard";

assertStagingHost();

const mediaDir =
  process.env.STAGING_E2E_MEDIA ??
  "/cursor/stores/bc-92314f63-d670-4644-be86-ba5aeb6af75c/media/staging-e2e";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./output/test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 12 * 60 * 1000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["json", { outputFile: "output/playwright-report.json" }]],
  use: {
    baseURL: process.env.STAGING_E2E_BASE_URL ?? "http://127.0.0.1:3000",
    timezoneId: "Asia/Hong_Kong",
    locale: "en-HK",
    video: "off",
    screenshot: "off",
    trace: "off",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  metadata: { mediaDir },
});
