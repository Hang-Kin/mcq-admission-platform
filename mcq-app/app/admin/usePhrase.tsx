"use client";

import { useEffect, useState } from "react";

import type { Locale } from "@/lib/i18n/index";

import { phrase } from "./translate";

export function useLiveLocale(): Locale {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const read = () => {
      const value = document.documentElement.getAttribute("data-locale");
      setLocale(value === "zh-Hant" ? "zh-Hant" : "en");
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-locale"] });
    return () => observer.disconnect();
  }, []);
  return locale;
}

/** One language, for placeholders, confirms, and pending labels. */
export function usePhrase(): (text: string) => string {
  const locale = useLiveLocale();
  return (text: string) => phrase(text, locale);
}

/** Option labels must be a string, not two hidden spans. */
export function OptionText({ text }: { text: string }) {
  return usePhrase()(text);
}

export function phraseNow(text: string): string {
  if (typeof document === "undefined") return phrase(text, "en");
  const locale = document.documentElement.getAttribute("data-locale") === "zh-Hant" ? "zh-Hant" : "en";
  return phrase(text, locale);
}
