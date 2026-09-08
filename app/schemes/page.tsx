"use client";

import { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import FilterChip from "@/components/shared/FilterChip";
import NoticeBox from "@/components/shared/NoticeBox";
import {
  ExternalIcon,
  GovernmentIcon,
  InfoIcon,
  RupeeIcon,
} from "@/components/icons";
import { useI18n } from "@/lib/I18nProvider";
import type { GovtScheme, SchemesPayload, SchemeCategory } from "@/lib/types";

const CAT_META: Record<
  SchemeCategory,
  { labelEn: string; labelHi: string; emoji: string }
> = {
  financial: { labelEn: "Financial support", labelHi: "आर्थिक सहायता", emoji: "💸" },
  insurance: { labelEn: "Insurance", labelHi: "बीमा", emoji: "🛡️" },
  irrigation: { labelEn: "Irrigation / water", labelHi: "सिंचाई / पानी", emoji: "💧" },
  soil: { labelEn: "Soil health", labelHi: "मिट्टी स्वास्थ्य", emoji: "🌱" },
  machinery: { labelEn: "Machinery", labelHi: "कृषि मशीनें", emoji: "🚜" },
  solar: { labelEn: "Solar energy", labelHi: "सौर ऊर्जा", emoji: "☀️" },
  horticulture: { labelEn: "Horticulture", labelHi: "बागवानी", emoji: "🍎" },
  market: { labelEn: "Market & FPO", labelHi: "बाज़ार और FPO", emoji: "🏷️" },
  skill: { labelEn: "More schemes", labelHi: "अन्य योजनाएँ", emoji: "📋" },
};

export default function SchemesPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<SchemesPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<SchemeCategory | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/schemes")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: SchemesPayload) => {
        setData(j);
        setBusy(false);
      })
      .catch(() => {
        setError(t("errors.network"));
        setBusy(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = (data?.schemes ?? []).filter((s: GovtScheme) => {
    if (cat && s.category !== cat) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.nameEn.toLowerCase().includes(q) ||
      s.nameHi.toLowerCase().includes(q) ||
      s.ministry.toLowerCase().includes(q) ||
      s.benefit.toLowerCase().includes(q)
    );
  });

  const schemeName = (s: GovtScheme) => (lang === "hi" ? s.nameHi : s.nameEn);

  return (
    <PageShell title={t("schemes.title")} subtitle={t("schemes.subtitle")} backHref="/">
      {busy ? <LoadingState message={t("schemes.loading")} /> : null}
      {error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="gov-src">
              <GovernmentIcon size={13} />
              {t("schemes.sourceGov")}
            </span>
            <span className="chip bg-surface text-ink-soft">
              {t("schemes.updated")} {data.updatedNote}
            </span>
          </div>

          <NoticeBox icon={<InfoIcon size={20} />} tone="info">
            {t("schemes.note")}
          </NoticeBox>

          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t("schemes.searchLabel")}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("schemes.searchPlaceholder")}
              className="min-h-12 w-full rounded-2xl border border-earth/30 bg-surface px-3 text-[1rem] font-bold text-ink"
            />
          </label>

          <div
            role="group"
            aria-label={t("schemes.categoryLabel")}
            className="flex flex-wrap items-center gap-2"
          >
            <FilterChip
              label={t("schemes.all")}
              active={cat === null}
              onClick={() => setCat(null)}
            />
            {data.categories.map((c) => (
              <FilterChip
                key={c}
                label={lang === "hi" ? CAT_META[c].labelHi : CAT_META[c].labelEn}
                emoji={CAT_META[c].emoji}
                active={cat === c}
                onClick={() => setCat(cat === c ? null : c)}
              />
            ))}
          </div>

          {filtered.length === 0 ? (
            <NoticeBox icon={<InfoIcon size={20} />} tone="warning">
              {t("schemes.none")}
            </NoticeBox>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <article key={s.id} className="card-sm flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[1.08rem] font-extrabold leading-snug text-ink">
                      {schemeName(s)}
                    </h3>
                    <span className="chip bg-earth-light text-earth">
                      {CAT_META[s.category].emoji}{" "}
                      {lang === "hi" ? CAT_META[s.category].labelHi : CAT_META[s.category].labelEn}
                    </span>
                  </div>
                  <p className="text-[0.8rem] font-semibold text-ink-soft">{s.ministry}</p>
                  <div className="panel">
                    <p className="text-[0.8rem] font-bold uppercase tracking-wide text-ink-soft">
                      {t("schemes.benefitLabel")}
                    </p>
                    <p className="mt-1 text-[0.96rem] leading-relaxed text-ink">{s.benefit}</p>
                  </div>
                  <div className="panel">
                    <p className="text-[0.8rem] font-bold uppercase tracking-wide text-ink-soft">
                      {t("schemes.eligibleLabel")}
                    </p>
                    <p className="mt-1 text-[0.94rem] leading-relaxed text-ink">{s.eligibility}</p>
                  </div>
                  {s.applyUrl ? (
                    <a
                      href={s.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary w-full"
                    >
                      <RupeeIcon size={18} />
                      {t("schemes.apply")}
                      <ExternalIcon size={16} />
                    </a>
                  ) : (
                    <p className="flex items-start gap-2 rounded-2xl border border-dashed border-earth/40 bg-earth-light p-3 text-[0.9rem] font-semibold text-earth">
                      <InfoIcon size={16} className="mt-0.5 shrink-0" />
                      {t("schemes.applyAtBank")}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink-soft">
                    <GovernmentIcon size={14} className="shrink-0 text-earth" />
                    {t("schemes.lastVerified")} {s.lastUpdated}
                  </p>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </PageShell>
  );
}