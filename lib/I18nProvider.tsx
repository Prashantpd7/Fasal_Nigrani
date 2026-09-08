"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANG,
  LANGS,
  getDictionary,
  translate,
  type Dictionary,
  type Interpolations,
  type Lang,
} from "./i18n";

const STORAGE_KEY = "fasal-nigrani-lang";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** Translate a dotted dictionary key in the active language. */
  t: (key: string, params?: Interpolations) => string;
  dict: Dictionary;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Browser-locale heuristic (§16): English browsers start in English,
 *  everything else starts in Hindi. Never applied over a saved choice. */
function preferredLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "hi" || saved === "en") return saved;
  } catch {
    /* storage unavailable — ignore */
  }
  const langs = window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language];
  const prefersEnglish = langs.some((l) => l.toLowerCase().startsWith("en"));
  return prefersEnglish ? "en" : DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server and client must render identical markup during hydration, so the
  // initial state is always DEFAULT_LANG; the saved preference / browser
  // heuristic is applied exactly once right after mount. This is a deliberate
  // external-system sync (localStorage + navigator), not a cascading update.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration sync of an external preference (localStorage/navigator); no cascading updates.
    setLangState(preferredLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    if (LANGS.includes(next)) setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((cur) => (cur === "hi" ? "en" : "hi"));
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = getDictionary(lang);
    return {
      lang,
      setLang,
      toggleLang,
      t: (key, params) => translate(dict, key, params),
      dict,
    };
  }, [lang, setLang, toggleLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}
