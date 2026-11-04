import {
  DEFAULT_PREFERENCES,
  documentPreferenceState,
  parsePreferences,
  PREFERENCE_COOKIE,
  PREFERENCE_STORAGE_KEY,
  preferenceCookie,
  preferencesFromSources,
  readCookieValue,
  serializePreferences,
  usesLegacyContrastTheme,
  type DocumentPreferenceState,
  type Preferences,
} from "./preferences";

export function readClientPreferences(): Preferences {
  if (typeof document === "undefined") return DEFAULT_PREFERENCES;
  let storage: string | null = null;
  try {
    storage = localStorage.getItem(PREFERENCE_STORAGE_KEY);
  } catch {
    storage = null;
  }
  const cookie = readCookieValue(document.cookie, PREFERENCE_COOKIE);
  const prefs = preferencesFromSources({ cookie, storage });
  if (usesLegacyContrastTheme(cookie) || usesLegacyContrastTheme(storage)) {
    persistPreferences(prefs);
  }
  return prefs;
}

export function persistPreferences(prefs: Preferences) {
  if (typeof document === "undefined") return;
  const raw = serializePreferences(prefs);
  try {
    localStorage.setItem(PREFERENCE_STORAGE_KEY, raw);
  } catch {
    // Private browsing can reject storage. The cookie still carries the choice.
  }
  const secure = location.protocol === "https:";
  document.cookie = preferenceCookie(raw, secure);
}

export function applyDocumentPreferenceState(state: DocumentPreferenceState) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", state.theme);
  root.setAttribute("data-locale", state.locale);
  root.setAttribute("data-shell", state.shell);
  root.lang = state.lang;
  root.style.fontSize = state.fontSize;
}

export function cookieMissing(): boolean {
  if (typeof document === "undefined") return true;
  return parsePreferences(readCookieValue(document.cookie, PREFERENCE_COOKIE)) == null;
}

export function applyStoredPreferences(stored: Preferences, pathname: string) {
  applyDocumentPreferenceState(documentPreferenceState(stored, pathname));
}
