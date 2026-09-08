"use client";

import { useI18n } from "@/lib/I18nProvider";
import type { Lang } from "@/lib/i18n";
import { LANGS } from "@/lib/i18n";

/**
 * LanguageSwitcher (§13, §16): text-only "हिं / EN" toggle — flags are not
 * used because language ≠ nationality. Lives in the top corner of every page
 * and instantly re-renders the whole tree via context.
 */
export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className="flex shrink-0 items-center rounded-full border border-earth/25 bg-surface p-0.5"
    >
      {LANGS.map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(l as Lang)}
            className={`min-h-9 min-w-11 cursor-pointer rounded-full px-2.5 text-[0.95rem] font-bold transition-colors ${
              active
                ? "bg-primary text-white"
                : "text-ink-soft hover:bg-primary-light/60"
            }`}
          >
            {l === "hi" ? "हिं" : "EN"}
          </button>
        );
      })}
    </div>
  );
}
