"use client";

import { useMemo, useState } from "react";
import { CROPS, cropName, type CropRec } from "@/lib/crops";
import type { CropId } from "@/lib/types";
import { useI18n } from "@/lib/I18nProvider";
import { SearchIcon } from "@/components/icons";

interface CropPickerProps {
  selected: CropId | null;
  onSelect: (id: CropId) => void;
}

/**
 * Simple crop selection (§ Farm — crop): big tappable chips with emoji + the
 * local name. A search box filters the fixed list — no scientific names, no
 * typing required. "Other" is always available.
 */
export default function CropPicker({ selected, onSelect }: CropPickerProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CROPS;
    return CROPS.filter(
      (c) => c.en.toLowerCase().includes(q) || c.hi.includes(q)
    );
  }, [query]);

  return (
    <div className="card">
      <h2 className="flex items-center gap-2 text-[1.1rem] font-extrabold text-ink">
        <span aria-hidden>🌱</span>
        {t("farm.cropTitle")}
      </h2>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">
        {t("farm.cropSubtitle")}
      </p>

      <div className="relative mt-3">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft">
          <SearchIcon size={18} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.searchPlaceholder")}
          aria-label={t("common.searchPlaceholder")}
          className="min-h-12 w-full rounded-2xl border border-earth/25 bg-bg px-4 py-2 pl-10 text-[1rem] text-ink placeholder:text-ink-soft/70 focus:border-primary"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((c: CropRec) => {
          const active = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-pressed={active}
              className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2.5 text-center transition-colors ${
                active
                  ? "border-primary bg-primary text-white"
                  : "border-earth/25 bg-bg text-ink hover:border-primary/40 hover:bg-primary-light/50"
              }`}
            >
              <span className="text-[1.35rem] leading-none" aria-hidden>
                {c.emoji}
              </span>
              <span className="text-[0.95rem] font-bold leading-tight">
                {cropName(c, lang)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}