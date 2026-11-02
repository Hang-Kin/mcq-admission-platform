import { cookies } from "next/headers";

import { DEFAULT_PREFERENCES, parsePreferences, PREFERENCE_COOKIE, type Preferences } from "./preferences";

export async function readServerPreferences(): Promise<Preferences> {
  const jar = await cookies();
  return parsePreferences(jar.get(PREFERENCE_COOKIE)?.value) ?? DEFAULT_PREFERENCES;
}
