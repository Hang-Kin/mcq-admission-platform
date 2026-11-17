import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../output/media");

/** Screenshots go to STAGING_E2E_MEDIA when it is set, otherwise e2e/output/media. */
export function stagingMediaDir(envValue: string | null | undefined): string {
  const trimmed = envValue?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : defaultDir;
}
