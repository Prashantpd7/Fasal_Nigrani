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

export default function MarketPage({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
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

  /** Aggregate dashboards values across every reported mandi. */
  const summary =
    shown && !shown.empty
      ? (() => {
          const modals = shown.mandis
            .map((m) => m.latest.modal)
            .filter((v): v is number => v !== null);
          const totalArr = shown.mandis.reduce(
            (s, m) => s + (m.latest.arrivalsMt ?? 0),
            0
          );
          return {
            modalAvg:
              modals.length
                ? Math.round(
                    modals.reduce((a, b) => a + b, 0) / modals.length
                  )
                : null,
            min: modals.length ? Math.min(...modals) : null,
            max: modals.length ? Math.max(...modals) : null,
            totalArr: totalArr > 0 ? Math.round(totalArr) : null,
            markets: modals.length,
          };
        })()
      : null;

  const dirInfo = (
    latest: number | null,
    prev: number | null
  ): { icon: React.ReactNode; tint: string; label: string } => {
    if (latest !== null && prev !== null && latest > prev)
      return {
        icon: <TrendUpIcon size={16} />,
        tint: "text-success",
        label: `+${(latest - prev).toLocaleString("en-IN")}`,
      };
    if (latest !== null && prev !== null && latest < prev)
      return {
        icon: <TrendDownIcon size={16} />,
        tint: "text-danger",
        label: `${(latest - prev).toLocaleString("en-IN")}`,
      };
    return { icon: <LeverIcon size={16} />, tint: "text-ink-soft", label: "·" };
  };

  const row = (m: MarketPayload["mandis"][number], i: number) => {
    const latest = m.latest.modal;
    const prev = m.previous?.modal ?? null;
    const d = dirInfo(latest, prev);
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
          <span className={`inline-flex items-center gap-1 text-[0.82rem] font-bold ${d.tint}`}>
            {d.icon}
            {d.label}
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
/** Desktop table of mandi rows (hidden on mobile where cards are used). */
  const tableRows = (mandis: MarketPayload["mandis"]) => (
    <div className="table-wrap">
      <table className="w-full border-collapse text-left text-[0.95rem]">
        <thead>
          <tr className="border-b border-earth/15 bg-bg text-[0.85rem] font-semibold text-ink-soft">
            <th className="px-4 py-2.5">{t("market.tableMarket")}</th>
            <th className="px-4 py-2.5 text-right">{t("market.modalPrice")} (₹/qtl)</th>
            <th className="px-4 py-2.5 text-right">{t("market.range")} (₹)</th>
            <th className="px-4 py-2.5 text-right">{t("market.arrivals")} (MT)</th>
            <th className="px-4 py-2.5">{t("market.trendLabel")}</th>
            <th className="px-4 py-2.5 text-center">{t("market.daysWeek")}</th>
          </tr>
        </thead>
        <tbody>
          {mandis.map((m, i) => {
            const latest = m.latest.modal;
            const prev = m.previous?.modal ?? null;
            const d = dirInfo(latest, prev);
            return (
              <tr key={`${m.name}-${i}`} className="border-b border-earth/10 hover:bg-primary-light/30">
                <td className="px-4 py-2.5">
                  <span className="block font-bold text-ink">{m.name}</span>
                  {m.latestDate ? (
                    <span className="block text-[0.8rem] text-ink-soft">📅 {m.latestDate}</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-right font-extrabold text-ink">
                  {latest !== null ? latest.toLocaleString("en-IN") : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-ink">
                  {m.latest.min !== null && m.latest.max !== null
                    ? `${m.latest.min.toLocaleString("en-IN")}–${m.latest.max.toLocaleString("en-IN")}`
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-ink">
                  {m.latest.arrivalsMt !== null ? m.latest.arrivalsMt.toLocaleString("en-IN") : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <Sparkline values={m.trend} width={110} height={30} ariaLabel={`${m.name} ${t("market.trendLabel")}`} />
                    <span className={`inline-flex items-center gap-1 text-[0.8rem] font-bold ${d.tint}`}>
                      {d.icon}
                      {d.label}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center text-ink-soft">{m.daysReported}/7</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderList = (mandis: MarketPayload["mandis"]) => (
    <>
      <div className="hidden lg:block">{tableRows(mandis)}</div>
      <div className="flex flex-col gap-4 lg:hidden">
        {mandis.map((m, i) => row(m, i))}
      </div>
      {mandis.length > 40 ? (
        <p className="rounded-2xl bg-bg px-4 py-2.5 text-center text-[0.92rem] font-semibold text-ink-soft">
          {t("market.showingTop")}
        </p>
      ) : null}
    </>
  );

  return (
    <PageShell embedded={embedded} title={t("market.title")} subtitle={t("market.subtitle")}>
      <section className="card-sm" aria-label={t("market.commodityLabel")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          {states.length > 0 ? (
            <label className="flex min-w-64 flex-col gap-1.5">
              <span className="field-label">{t("market.stateLabel")}</span>
              <select
                value={stateId}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setStateId(next);
                  load(next, crop);
                }}
                className="input-base cursor-pointer font-bold"
              >
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="sr-only">{t("market.commodityLabel")}</p>
        </div>
        <div role="group" aria-label={t("market.commodityLabel")} className="mt-3 flex flex-wrap items-center gap-2">
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
      </section>

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

          {summary ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="stat-pill">
                <dt className="sr-only">{t("market.modalPrice")}</dt>
                <dd className="text-[1.25rem] font-extrabold text-primary">
                  ₹{summary.modalAvg !== null ? summary.modalAvg.toLocaleString("en-IN") : "—"}
                </dd>
                <p className="mt-0.5 text-[0.8rem] font-semibold text-ink-soft">{t("market.modalPrice")} · {t("market.avgLabel")}</p>
              </div>
              <div className="stat-pill">
                <dt className="sr-only">{t("market.range")}</dt>
                <dd className="text-[1.1rem] font-extrabold text-ink">
                  ₹{summary.min !== null && summary.max !== null ? `${summary.min.toLocaleString("en-IN")}–${summary.max.toLocaleString("en-IN")}` : "—"}
                </dd>
                <p className="mt-0.5 text-[0.8rem] font-semibold text-ink-soft">{t("market.range")}</p>
              </div>
              <div className="stat-pill">
                <dt className="sr-only">{t("market.totalArrivals")}</dt>
                <dd className="text-[1.1rem] font-extrabold text-earth">
                  {summary.totalArr !== null ? `${summary.totalArr.toLocaleString("en-IN")} MT` : "—"}
                </dd>
                <p className="mt-0.5 text-[0.8rem] font-semibold text-ink-soft">{t("market.totalArrivals")}</p>
              </div>
              <div className="stat-pill">
                <dt className="sr-only">{t("market.marketsReported")}</dt>
                <dd className="text-[1.1rem] font-extrabold text-ink">{summary.markets}</dd>
                <p className="mt-0.5 text-[0.8rem] font-semibold text-ink-soft">{t("market.marketsReported")}</p>
              </div>
            </dl>
          ) : null}

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
              {renderList(shown.mandis.slice(0, 60))}
            </>
          ) : (
            <>
              <h2 className="section-head">
                <RupeeIcon size={19} className="text-primary" />
                {t("market.mandiTitle")} — {shown.commodityName} ({shown.stateName})
              </h2>
              {renderList(shown.mandis)}
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