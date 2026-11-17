import { existsSync } from "node:fs";
import path from "node:path";

/** Screenshots go to STAGING_E2E_MEDIA when it is set, otherwise e2e/output/media. */
export function stagingMediaDir(envValue: string | null | undefined): string {
  const trimmed = envValue?.trim() ?? "";
  if (trimmed.length > 0) return trimmed;
  const fromE2e = path.resolve(process.cwd(), "output/media");
  if (existsSync(path.resolve(process.cwd(), "playwright.config.ts"))) return fromE2e;
  return path.resolve(process.cwd(), "e2e/output/media");
}
