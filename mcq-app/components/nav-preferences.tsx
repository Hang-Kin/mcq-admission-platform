"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  applyStoredPreferences,
  cookieMissing,
  persistPreferences,
  readClientPreferences,
} from "@/lib/preferences/browser";
import {
  DEFAULT_PREFERENCES,
  isExamPath,
  samePreferences,
  viewPreferences,
  type Locale,
  type Preferences,
  type ThemeName,
  type UiSize,
} from "@/lib/preferences/preferences";

type PreferencesApi = {
  stored: Preferences;
  locale: Locale;
  exam: boolean;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeName) => void;
  setSize: (size: UiSize) => void;
  resetSize: () => void;
};

const PreferencesContext = createContext<PreferencesApi | null>(null);

export function PreferencesProvider({
  initial,
  children,
}: {
  initial: Preferences;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [stored, setStored] = useState(initial);
  const exam = isExamPath(pathname);

  useLayoutEffect(() => {
    const path = pathname || window.location.pathname;
    const client = readClientPreferences();
    if (!samePreferences(client, stored)) {
      if (cookieMissing()) persistPreferences(client);
      setStored(client);
      return;
    }
    applyStoredPreferences(stored, path);
  }, [pathname, stored]);

  const api = useMemo<PreferencesApi>(() => {
    function commit(next: Preferences) {
      persistPreferences(next);
      setStored(next);
      const path = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
      applyStoredPreferences(next, path);
    }
    return {
      stored,
      locale: viewPreferences(stored, pathname).locale,
      exam,
      setLocale: (locale) => commit({ ...stored, locale }),
      setTheme: (theme) => commit({ ...stored, theme }),
      setSize: (size) => commit({ ...stored, size }),
      resetSize: () => commit({ ...stored, size: 100 }),
    };
  }, [exam, pathname, stored]);

  return <PreferencesContext.Provider value={api}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesApi {
  const value = useContext(PreferencesContext);
  if (value) return value;
  return {
    stored: DEFAULT_PREFERENCES,
    locale: "en",
    exam: false,
    setLocale: () => {},
    setTheme: () => {},
    setSize: () => {},
    resetSize: () => {},
  };
}
