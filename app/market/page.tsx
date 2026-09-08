"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PageShell from "@/components/PageShell";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import FilterChip from "@/components/shared/FilterChip";
import NoticeBox from "@/components/shared/NoticeBox";
import Sparkline from "@/components/shared/Sparkline";
import { SourceChip } from "@/components/shared/DataChip";
import {
  BasketIcon,
  InfoIcon,
  LeverIcon,
  RefreshIcon,
  RupeeIcon,
  SearchIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@/components/icons";
import { useI18n } from "@/lib/I18nProvider";
import { POPULAR_COMMODITIES, commodityLabel } from "@/lib/marketCatalog";
import type { MarketPayload } from "@/lib/types";

interface StateRec {
  id: number;
  name: string;
}

export default function MarketPage() {
  const { t, lang } = useI18n();
  const [states, setStates] = useState<StateRec[]>([]);
  const [stateId, setStateId] = useState(29); // Rajasthan default
  const [crop, setCrop] = useState("wheat");
  const [result, setResult] = useState<MarketPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const load = useCallback(
    (state: number, cropId: string) => {
      const id = ++runId.current;
      setBusy(true);
      setError(null);
      fetch(`/api/market?crop=${encodeURIComponent(cropId)}&stateId=${state}&lang=${lang}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((j: MarketPayload) => {
          if (runId.current !== id) return;
          setResult(j);
          setBusy(false);
        })
        .catch(() => {
          if (runId.current !== id) return;
          setError(t("errors.network"));
          setBusy(false);
        });
    },
    [lang, t]
  );

  useEffect(() => {
    const id = ++runId.current;
    (async () => {
      try {
        const r = await fetch("/api/market/states");
        const j = (await r.json()) as { states?: StateRec[] };
        if (runId.current !== id) return;
        if (j?.states?.length) setStates(j.states);
      } catch {
        // Optional state list — ignore failures.
      }
      if (runId.current !== id) return;
      if (!result) load(stateId, crop);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () => load(stateId, crop);

  /** Non-null alias — TS narrows cleanly inside the JSX below. */
  const shown = result;

  const row = (m: MarketPayload["mandis"][number], i: number) => {
    const latest = m.latest.modal;
    const prev = m.previous?.modal ?? null;
    const dir =
      latest !== null && prev !== null
        ? latest > prev ? "up" : latest < prev ? "down" : "flat"
        : "flat";
    const dirIcon =
      dir === "up" ? <TrendUpIcon size={16} /> : dir === "down" ? <TrendDownIcon size={16} /> : <LeverIcon size={16} />;
    const dirTint =
      dir === "up" ? "text-success" : dir === "down" ? "text-danger" : "text-ink-soft";
    return (
      <article key={`${m.name}-${i}`} className="card-sm flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[1.08rem] font-extrabold leading-snug text-ink">{m.name}</h3>
          {m.latestDate ? (
            <span className="chip bg-earth-light text-earth">📅 {m.latestDate}</span>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 gap-2">
          <div className="stat-pill">
            <dt className="sr-only">{t("market.modalPrice")}</dt>
            <dd className="text-[1.05rem] font-extrabold">
              {latest !== null ? `₹${latest.toLocaleString("en-IN")}` : t("market.noRate")}
            </dd>
            <p className="mt-0.5 text-[0.76rem] font-semibold text-ink-soft">{t("market.modalPrice")}</p>
          </div>
          <div className="stat-pill">
            <dt className="sr-only">{t("market.range")}</dt>
            <dd className="text-[0.98rem] font-extrabold">
              {m.latest.min !== null && m.latest.max !== null
                ? `₹${m.latest.min.toLocaleString("en-IN")}–${m.latest.max.toLocaleString("en-IN")}`
                : "—"}
            </dd>
            <p className="mt-0.5 text-[0.76rem] font-semibold text-ink-soft">{t("market.range")}</p>
          </div>
          <div className="stat-pill">
            <dt className="sr-only">{t("market.arrivals")}</dt>
            <dd className="text-[0.98rem] font-extrabold">
              {m.latest.arrivalsMt !== null ? `${m.latest.arrivalsMt.toLocaleString("en-IN")} MT` : "—"}
            </dd>
            <p className="mt-0.5 text-[0.76rem] font-semibold text-ink-soft">{t("market.arrivals")}</p>
          </div>
        </dl>

        <div className="flex items-center gap-3">
          <Sparkline
            values={m.trend}
            width={150}
            height={36}
            ariaLabel={`${m.name} ${t("market.trendLabel")}`}
          />
          <span className={`inline-flex items-center gap-1 text-[0.82rem] font-bold ${dirTint}`}>
            {dirIcon}
            {latest !== null && prev !== null
              ? `${latest >= prev ? "+" : ""}${(latest - prev).toLocaleString("en-IN")}`
              : "·"}
          </span>
          <span className="text-[0.78rem] font-semibold text-ink-soft">{m.daysReported}/{t("market.daysWeek")}</span>
        </div>
        <p className="flex items-center gap-1.5 text-[0.82rem] font-semibold text-ink-soft">
          <InfoIcon size={14} className="shrink-0" />
          {t("market.unitNote")}
        </p>
      </article>
    );
  };

  return (
    <PageShell title={t("market.title")} subtitle={t("market.subtitle")} backHref="/">
      {states.length > 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t("market.stateLabel")}</span>
          <select
            value={stateId}
            onChange={(e) => {
              const next = Number(e.target.value);
              setStateId(next);
              load(next, crop);
            }}
            className="min-h-12 w-full cursor-pointer rounded-2xl border border-earth/30 bg-surface px-3.5 text-[1rem] font-bold text-ink"
          >
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div
        role="group"
        aria-label={t("market.commodityLabel")}
        className="flex flex-wrap items-center gap-2"
      >
        {POPULAR_COMMODITIES.map((c) => (
          <FilterChip
            key={c.id}
            label={commodityLabel(c, lang)}
            emoji={c.emoji}
            active={crop === c.id}
            onClick={() => {
              setCrop(c.id);
              load(stateId, c.id);
            }}
          />
        ))}
      </div>

      {busy && !result ? <LoadingState message={t("market.checking")} /> : null}
      {error ? <ErrorState message={error ?? ""} onRetry={refresh} /> : null}

      {shown ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SourceChip source={shown.source} />
            <span className="gov-src">
              <BasketIcon size={13} />
              {t("market.sourceGov")}
            </span>
            <span className="chip bg-surface text-ink-soft">
              <RefreshIcon size={14} />
              {t("market.updated")}{" "}
              {new Date(shown.fetchedAt).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN")}
            </span>
          </div>

          {shown.empty ? (
            <NoticeBox icon={<InfoIcon size={20} />} tone="warning">
              {t("market.noReportHint")}
            </NoticeBox>
          ) : shown.source === "live" ? (
            <>
              <h2 className="section-head">
                <RupeeIcon size={19} className="text-primary" />
                {t("market.mandiTitle")} — {shown.commodityName} ({shown.stateName})
              </h2>
              <div className="flex flex-col gap-4">
                {shown.mandis.slice(0, 40).map((m, i) => row(m, i))}
              </div>
              {shown.mandis.length > 40 ? (
                <p className="text-center text-[0.9rem] font-semibold text-ink-soft">
                  {t("market.showingTop")}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h2 className="section-head">
                <RupeeIcon size={19} className="text-primary" />
                {t("market.mandiTitle")} — {shown.commodityName} ({shown.stateName})
              </h2>
              <div className="flex flex-col gap-4">
                {shown.mandis.map((m, i) => row(m, i))}
              </div>
              <NoticeBox icon={<InfoIcon size={20} />} tone="warning">
                {t("common.demoDataNote")}
              </NoticeBox>
            </>
          )}

          <NoticeBox icon={<SearchIcon size={20} />} tone="info">
            <span className="flex flex-col gap-1">
              <span className="font-bold">{t("market.agmarknetNoteTitle")}</span>
              <span>{t("market.agmarknetNote")}</span>
            </span>
          </NoticeBox>

          <button type="button" className="btn-secondary w-full" onClick={refresh}>
            <RefreshIcon size={18} />
            {t("market.refresh")}
          </button>
        </>
      ) : null}
    </PageShell>
  );
}