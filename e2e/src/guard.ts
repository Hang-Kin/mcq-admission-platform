/** Refuse to run unless the staging host is the zdprf project. */
export function assertStagingHost(): string {
  const raw = process.env.STAGING_SUPABASE_URL ?? "";
  const url = raw.trim();
  if (!url.startsWith("https://zdprf")) {
    throw new Error(
      "Refusing to run: STAGING_SUPABASE_URL does not start with https://zdprf.",
    );
  }
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    throw new Error("Refusing to run: STAGING_SUPABASE_URL is not a URL.");
  }
  if (host.startsWith("dzdd") || url.startsWith("https://dzdd")) {
    throw new Error("Refusing to run: live host is blocked.");
  }
  if (!process.env.STAGING_SUPABASE_ANON_KEY?.trim()) {
    throw new Error("Refusing to run: STAGING_SUPABASE_ANON_KEY is missing.");
  }
  return url;
}

export function stagingAnonKey(): string {
  assertStagingHost();
  return process.env.STAGING_SUPABASE_ANON_KEY!.trim();
}
