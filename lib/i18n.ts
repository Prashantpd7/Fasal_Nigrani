import en from "@/locales/en.json";
import hi from "@/locales/hi.json";

export type Lang = "hi" | "en";
export const LANGS: Lang[] = ["hi", "en"];
export const DEFAULT_LANG: Lang = "hi";

// Both files share the exact same nested shape; en is the reference type.
const dictionaries: Record<Lang, typeof en> = { en, hi };

export type Dictionary = typeof en;
export type Dict = Dictionary;

/** Values substituted into "{placeholder}" slots in a translation string. */
export type Interpolations = Record<string, string | number>;

export function getDictionary(lang: Lang): Dictionary {
  return dictionaries[lang] ?? en;
}

/** Look up a nested key ("weather.rule.warn.rainHigh") inside a dictionary. */
export function lookup(dict: Dictionary, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

export function translate(
  dict: Dictionary,
  key: string,
  params?: Interpolations
): string {
  const raw = lookup(dict, key);
  let str = typeof raw === "string" ? raw : "";
  if (!str) {
    // Missing key: fall back to English, then to the raw key so a missing
    // translation visibly leaks during development instead of silently
    // breaking the UI (§33: no raw key names should reach the user).
    if (dict !== en) return translate(en, key, params);
    if (typeof raw === "string") return raw;
    return key;
  }
  if (!params) return str;
  for (const [name, value] of Object.entries(params)) {
    str = str.replaceAll(`{${name}}`, String(value));
  }
  return str;
}

/** Convenience: translate in a specific language (used server-side). */
export function tLang(lang: Lang, key: string, params?: Interpolations): string {
  return translate(getDictionary(lang), key, params);
}
