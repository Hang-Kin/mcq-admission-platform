import { isLocale, type Locale } from "@/lib/i18n/locale";

export type { Locale };

export const PREFERENCE_COOKIE = "mcq-prefs";
export const PREFERENCE_STORAGE_KEY = "mcq-prefs";
export const PREFERENCE_MAX_AGE = 60 * 60 * 24 * 365;

export const UI_SIZES = [50, 75, 100, 125, 150, 175, 200] as const;
export type UiSize = (typeof UI_SIZES)[number];

export const THEMES = ["normal", "contrast"] as const;
export type ThemeName = (typeof THEMES)[number];

export type Preferences = {
  locale: Locale;
  theme: ThemeName;
  size: UiSize;
};

export const DEFAULT_PREFERENCES: Preferences = {
  locale: "en",
  theme: "normal",
  size: 100,
};

export function isUiSize(value: number): value is UiSize {
  return (UI_SIZES as readonly number[]).includes(value);
}

export function isThemeName(value: string): value is ThemeName {
  return value === "normal" || value === "contrast";
}

/** A valid stored value, or null when the string is missing or broken. */
export function parsePreferences(raw: string | null | undefined): Preferences | null {
  if (!raw) return null;
  const text = raw.trim();
  const parts = text.split(".");
  if (parts.length !== 3) return null;
  const [locale, theme, sizeText] = parts;
  if (!locale || !isLocale(locale)) return null;
  if (!theme || !isThemeName(theme)) return null;
  const size = Number(sizeText);
  if (!isUiSize(size)) return null;
  return { locale, theme, size };
}

export function serializePreferences(prefs: Preferences): string {
  return `${prefs.locale}.${prefs.theme}.${prefs.size}`;
}

export function samePreferences(a: Preferences, b: Preferences): boolean {
  return a.locale === b.locale && a.theme === b.theme && a.size === b.size;
}

/** Cookie wins. localStorage is used only when the cookie is missing or invalid. */
export function preferencesFromSources(input: {
  cookie: string | null | undefined;
  storage: string | null | undefined;
}): Preferences {
  return parsePreferences(input.cookie) ?? parsePreferences(input.storage) ?? DEFAULT_PREFERENCES;
}

export function preferenceCookie(raw: string, secure = false): string {
  const secureAttr = secure ? "; Secure" : "";
  return `${PREFERENCE_COOKIE}=${encodeURIComponent(raw)}; Path=/; Max-Age=${PREFERENCE_MAX_AGE}; SameSite=Lax${secureAttr}`;
}

export function readCookieValue(cookieHeader: string, name = PREFERENCE_COOKIE): string | null {
  const pieces = cookieHeader.split(";");
  const prefix = `${name}=`;
  for (const piece of pieces) {
    const part = piece.trim();
    if (!part.startsWith(prefix)) continue;
    const value = part.slice(prefix.length);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export function isExamPath(pathname: string): boolean {
  return pathname === "/session" || pathname.startsWith("/session/");
}

/** What the page should show. The exam screen keeps the defaults. */
export function viewPreferences(stored: Preferences, pathname: string): Preferences {
  if (isExamPath(pathname)) return DEFAULT_PREFERENCES;
  return stored;
}

export type DocumentPreferenceState = {
  theme: ThemeName;
  locale: Locale;
  shell: "exam" | "staff";
  fontSize: string;
  lang: "en" | "zh-Hant";
};

export function documentPreferenceState(
  stored: Preferences,
  pathname: string,
): DocumentPreferenceState {
  const exam = isExamPath(pathname);
  const view = viewPreferences(stored, pathname);
  return {
    theme: view.theme,
    locale: view.locale,
    shell: exam ? "exam" : "staff",
    fontSize: `${view.size}%`,
    lang: view.locale === "zh-Hant" ? "zh-Hant" : "en",
  };
}
