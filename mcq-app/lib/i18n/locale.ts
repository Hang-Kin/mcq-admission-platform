export const LOCALES = ["en", "zh-Hant"] as const;

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return value === "en" || value === "zh-Hant";
}
