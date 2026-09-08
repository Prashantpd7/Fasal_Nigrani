"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/I18nProvider";
import type {
  AgriOutcome,
} from "@/lib/agriculture";
import { analyzeAgriculture } from "@/lib/agriculture";
import {
  type AgroMonitoringData,
  type FarmState,
  type SatelliteStats,
  type SatelliteStatus,
  type WeatherPayload,
} from "@/lib/types";
import { cropById } from "@/lib/crops";
import WeatherSummaryCard from "@/components/WeatherSummaryCard";
import WeatherWarningBanner from "@/components/WeatherWarningBanner";
import ForecastStrip from "@/components/ForecastStrip";
import { SourceChip, StaleChip } from "@/components/shared/DataChip";
import LoadingState from "@/components/shared/LoadingState";
import FarmMap from "./FarmMap";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  DropletIcon,
  InfoIcon,
  LayersIcon,
  MapPinIcon,
  RefreshIcon,
  SatelliteIcon,
  SprinklerIcon,
  WindIcon,
} from "@/components/icons";

interface FarmDashboardProps {
  farm: FarmState;
  weather: WeatherPayload;
  stale: boolean;
  status: SatelliteStatus | null;
  statusBusy: boolean;
  statusFailed: boolean;
  stats: SatelliteStats | null;
  statsBusy: boolean;
  /** Real AgroMonitoring field-level monitoring (NDVI history, imagery, soil). */
  agro: AgroMonitoringData | null;
  agroBusy: boolean;
  agroFailed: boolean;
  onRefreshWeather: () => void;
  onRefreshSatellite: () => void;
  onRefreshAgro: () => void;
  onEditField: () => void;
  onEditCrop: () => void;
}

const STATUS_TINT: Record<string, string> = {
  healthy: "bg-success-light text-success",
  watch: "bg-warning-light text-warning",
  stress: "bg-danger-light text-danger",
  insufficient: "bg-earth-light text-earth",
};

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** True only for finite numbers — guards against undefined/NaN from any
 *  source (including stale cached AgroMonitoring payloads). */
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Format a finite number with 2 decimals; otherwise render an en-dash. */
function fmt2(v: unknown): string {
  return isNum(v) ? v.toFixed(2) : "—";
}

/** Format a finite number with 0 decimals; otherwise render an en-dash. */
function fmt0(v: unknown): string {
  return isNum(v) ? v.toFixed(0) : "—";
}

/** Build the agri engine input from real weather + satellite measurements. */
function buildAgriInput(
  farm: FarmState,
  weather: WeatherPayload,
  stats: SatelliteStats | null
): AgriOutcome | null {
  if (!farm.crop) return null;
  const dryDayCount = weather.forecast.filter(
    (d) => (d.precipProb ?? 0) < 30 && (d.precipSum ?? 0) < 1
  ).length;
  const firstRainDayIndex = weather.forecast.findIndex(
    (d) => (d.precipProb ?? 0) >= 50
  );
  const windMax = Math.max(
    weather.current.windKmh,
    ...weather.forecast.map((d) => d.windMax ?? 0)
  );
  return analyzeAgriculture({
    crop: farm.crop,
    rainProbNext24: weather.next24.rainProbMax,
    rainSumNext24: weather.next24.rainSum,
    tMaxToday: weather.today.tMax,
    tMaxNext7: Math.max(...weather.forecast.map((d) => d.tMax)),
    windMax,
    dry7Days: dryDayCount >= 7,
    dryDayCount,
    ndviMean: stats?.ndviMean ?? null,
    ndviPrevMean: stats?.ndviPrevMean ?? null,
    validPixels: stats?.validPixels ?? 0,
    cloudPct: stats?.cloudPct ?? null,
    firstRainDayIndex,
    forecast: weather.forecast,
  });
}

export default function FarmDashboard(props: FarmDashboardProps) {
  const { t, lang } = useI18n();
  const {
    farm,
    weather,
    stale,
    status,
    stats,
    statsBusy,
    statusBusy,
    statusFailed,
    agro,
    agroBusy,
    agroFailed,
  } = props;
  const [showDetails, setShowDetails] = useState(false);

  const crop = cropById(farm.crop);
  const outcome = useMemo(
    () => buildAgriInput(farm, weather, stats),
    [farm, weather, stats]
  );

  // Merged warnings: weather warnings + crop-specific agri warnings.
  const agriWarnings =
    outcome?.warnings.map((w) => ({
      severity: w.severity,
      message: t(w.key, w.params),
    })) ?? [];
  const warnings = [...weather.warnings, ...agriWarnings];
  const importantWarnings = warnings.filter((w) => w.severity !== "info");
  const infoNotes = warnings.filter((w) => w.severity === "info");

  // Merged actions: crop-specific first, then weather actions (max 3).
  const agriActions =
    outcome?.actions.map((a) => ({
      key: a.key,
      message: t(a.key, a.params),
    })) ?? [];
  const weatherActions = weather.actions.map((m) => ({ key: "weather", message: m }));
  const isRoutineOnly =
    agriActions.length === 1 && agriActions[0].key === "farm.rule.act.routine";
  let actions = isRoutineOnly
    ? agriActions
    : [...agriActions, ...weatherActions];
  const seen = new Set<string>();
  actions = actions
    .filter((a) => {
      if (seen.has(a.message)) return false;
      seen.add(a.message);
      return true;
    })
    .slice(0, 3);

  const updatedLabel = useMemo(() => {
    const d = new Date(weather.fetchedAt);
    return d.toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [weather.fetchedAt, lang]);

  const rainDays = weather.forecast
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => (d.precipProb ?? 0) >= 50);
  const rainDayLabel = (i: number) =>
    i === 0
      ? t("weather.dayToday")
      : t("farm.dayOffset", { days: String(i + 1) });

  return (
    <div className="flex flex-col gap-4">
      {/* Farm header */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[1rem] font-extrabold text-ink">
              <MapPinIcon size={18} className="text-primary" />
              {farm.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {stale ? <StaleChip /> : null}
            <SourceChip source={weather.source} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.92rem] font-semibold text-ink-soft">
          <span className="chip bg-primary-light text-primary">
            {crop ? `${crop.emoji} ${farm.cropLabel}` : t("farm.noCrop")}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon size={15} />
            {t("farm.lastUpdated")}: {updatedLabel}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={props.onRefreshWeather}>
            <RefreshIcon size={18} />
            {t("weather.refresh")}
          </button>
          <button type="button" className="btn-ghost" onClick={props.onEditField}>
            <MapPinIcon size={18} />
            {t("farm.editField")}
          </button>
          <button type="button" className="btn-ghost" onClick={props.onEditCrop}>
            🌱 {t("farm.editCrop")}
          </button>
        </div>
      </section>

      {/* Small action cards */}
      <section className="flex flex-wrap gap-2" aria-label={t("farm.quickTitle")}>
        <QuickCard label={t("farm.cardToday")} icon={<CalendarIcon size={18} />} onClick={() => scrollTo("weather-today")} />
        <QuickCard label={t("farm.cardRain")} icon={<DropletIcon size={18} />} onClick={() => scrollTo("forecast")} />
        <QuickCard label={t("farm.cardWater")} icon={<SprinklerIcon size={18} />} onClick={() => scrollTo("advice")} />
        <QuickCard label={t("farm.cardHealth")} icon={<CheckIcon size={18} />} onClick={() => scrollTo("crop-health")} />
        <QuickCard label={t("farm.cardSatellite")} icon={<SatelliteIcon size={18} />} onClick={() => scrollTo("your-farm")} />
        <QuickCard label={t("farm.cardStress")} icon={<LayersIcon size={18} />} onClick={() => scrollTo("crop-health")} />
        <QuickCard label={t("farm.card7day")} icon={<CalendarIcon size={18} />} onClick={() => scrollTo("forecast")} />
      </section>

      {/* WEATHER TODAY */}
      <section id="weather-today" className="scroll-mt-4">
        <WeatherSummaryCard weather={weather} stale={stale} />
        <div className="card mt-3 !pt-3">
          {outcome ? (
            <p className="rounded-2xl bg-bg px-3 py-2.5 text-[1rem] font-semibold leading-relaxed text-ink">
              {t(outcome.cards.weatherToday.key, outcome.cards.weatherToday.params)}
            </p>
          ) : null}
          <dl className="mt-2 grid grid-cols-3 gap-2">
            <Metric label={t("farm.metricRainChance")} value={weather.next24.rainProbMax !== null ? `${weather.next24.rainProbMax}%` : "—"} tint={weather.next24.rainProbMax >= 60 ? "text-danger" : "text-ink"} icon={<DropletIcon size={16} />} />
            <Metric label={t("farm.metricRainMm")} value={weather.next24.rainSum > 0 ? `${weather.next24.rainSum} mm` : "0 mm"} icon={<DropletIcon size={16} />} />
            <Metric label={t("farm.metricFeels")} value={weather.current.apparentTemp !== null ? `${weather.current.apparentTemp}°` : "—"} icon={<span aria-hidden>🌡️</span>} />
            <Metric label={t("farm.metricWind")} value={`${weather.current.windKmh} km/h`} icon={<WindIcon size={16} />} />
            <Metric label={t("farm.metricHumidity")} value={`${weather.current.humidity}%`} icon={<span aria-hidden>💧</span>} />
            <Metric label={t("farm.metricCloud")} value={weather.current.cloudCover !== null ? `${weather.current.cloudCover}%` : "—"} icon={<span aria-hidden>☁️</span>} />
          </dl>
          <p className="mt-2 px-1 text-[0.85rem] font-medium text-ink-soft">
            {t("farm.sourceOpenMeteo")} · {t("farm.updatedAt")} {updatedLabel}
          </p>
        </div>
      </section>

      {/* 7-DAY WEATHER */}
      <section id="forecast" className="scroll-mt-4">
        <ForecastStrip days={weather.forecast} />
        <div className="card mt-3 !pt-3">
          {outcome ? (
            <p className="rounded-2xl bg-bg px-3 py-2.5 text-[1rem] font-semibold leading-relaxed text-ink">
              {t(outcome.cards.rainWhen.key, outcome.cards.rainWhen.params)}
            </p>
          ) : null}
          {rainDays.length > 0 ? (
            <p className="mt-2 px-1 text-[0.92rem] font-medium text-ink-soft">
              {t("farm.rainDaysLine", {
                days: rainDays.map(({ i }) => rainDayLabel(i)).join(", "),
              })}
            </p>
          ) : null}
          <p className="mt-2 px-1 text-[0.85rem] font-medium text-ink-soft">
            {t("farm.sourceOpenMeteo")}
          </p>
        </div>
      </section>

      {/* YOUR FARM — satellite map */}
      <section id="your-farm" className="scroll-mt-4">
        <SectionTitle icon={<SatelliteIcon size={20} />} text={t("farm.yourFarmTitle")} />
        {farm.polygon && farm.polygon.ring.length >= 3 ? (
          <>
            <FarmMap
              center={{ lat: farm.lat, lon: farm.lon }}
              status={status}
              polygon={farm.polygon}
              onPolygonChange={() => {}}
              height={340}
              editable={false}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={props.onRefreshSatellite}
                disabled={statusBusy || statsBusy}
              >
                <RefreshIcon size={18} />
                {statusBusy || statsBusy ? t("farm.satelliteChecking") : t("farm.refreshSatellite")}
              </button>
              {statusFailed ? (
                <span className="inline-flex items-center gap-1 text-[0.88rem] font-semibold text-warning">
                  <InfoIcon size={15} />
                  {t("farm.satelliteSourceDown")}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="card text-center">
            <p className="text-[1.02rem] font-semibold leading-relaxed text-ink">
              {t("farm.noFieldHint")}
            </p>
            <button type="button" className="btn-primary mt-3" onClick={props.onEditField}>
              <MapPinIcon size={20} />
              {t("farm.selectField")}
            </button>
          </div>
        )}

        {/* AgroMonitoring — real field-level satellite observation */}
        <div className="card mt-3 !pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[1rem] font-extrabold text-ink">
              <SatelliteIcon size={18} className="text-primary" />
              {t("farm.agroTitle")}
            </h3>
            {agroBusy ? <LoadingState message={t("farm.agroChecking")} /> : null}
          </div>
          {agro && agro.ok && agro.imagery ? (
            <>
              {agro.polyId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/agromonitoring/image?polyid=${encodeURIComponent(agro.polyId)}&dt=${agro.imagery.dt}`}
                  alt={t("farm.agroImageAlt")}
                  className="mt-3 w-full rounded-2xl border border-earth/20 bg-bg object-contain"
                  loading="lazy"
                />
              ) : null}
              <ul className="mt-3 flex flex-col gap-1.5 text-[0.95rem] text-ink">
                <li className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                  <span className="font-semibold text-ink-soft">{t("farm.agroObsDate")}</span>
                  <span className="font-extrabold text-ink">{formatObsDate(agro.imagery.dt, lang)}</span>
                </li>
                <li className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                  <span className="font-semibold text-ink-soft">{t("farm.agroSatellite")}</span>
                  <span className="font-extrabold text-ink">{agro.imagery.satellite}</span>
                </li>
                {agro.imagery.cloudPct !== null ? (
                  <li className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                    <span className="font-semibold text-ink-soft">{t("farm.agroCloud")}</span>
                    <span className="font-extrabold text-ink">{agro.imagery.cloudPct}%</span>
                  </li>
                ) : null}
                {agro.imagery.coveragePct !== null ? (
                  <li className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                    <span className="font-semibold text-ink-soft">{t("farm.agroCoverage")}</span>
                    <span className="font-extrabold text-ink">{agro.imagery.coveragePct}%</span>
                  </li>
                ) : null}
              </ul>
              <p className="mt-2 px-1 text-[0.85rem] font-medium text-ink-soft">
                {t("farm.sourceAgroMonitoring")} · {t("farm.satelliteObservationLine")}
              </p>
            </>
          ) : agroFailed || (agro && !agro.ok) ? (
            <p className="mt-2 rounded-2xl bg-bg px-3 py-2.5 text-[0.95rem] font-semibold leading-relaxed text-ink-soft">
              {t("farm.agroUnavailable")}
            </p>
          ) : (
            <p className="mt-2 rounded-2xl bg-bg px-3 py-2.5 text-[0.95rem] font-semibold leading-relaxed text-ink-soft">
              {t("farm.agroWaiting")}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={props.onRefreshAgro}
              disabled={agroBusy}
            >
              <RefreshIcon size={18} />
              {agroBusy ? t("farm.agroChecking") : t("farm.refreshSatellite")}
            </button>
            {agro?.configured === false || agroFailed ? (
              <span className="inline-flex items-center gap-1 text-[0.88rem] font-semibold text-warning">
                <InfoIcon size={15} />
                {t("farm.agroNotConfigured")}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* CROP HEALTH */}
      <section id="crop-health" className="scroll-mt-4">
        <SectionTitle icon={<CheckIcon size={20} />} text={t("farm.cropHealthTitle")} />
        <div className="card">
          {statsBusy || statusBusy ? (
            <LoadingState message={t("farm.satelliteChecking")} />
          ) : outcome ? (
            <>
              <span
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-[1.05rem] font-extrabold ${STATUS_TINT[outcome.health.status]}`}
              >
                {t(outcome.health.labelKey)}
              </span>
              <p className="mt-3 text-[0.98rem] font-semibold leading-relaxed text-ink">
                {t(outcome.cards.cropHealthy.key, outcome.cards.cropHealthy.params)}
              </p>

              {stats?.ndviMean !== null && stats ? (
                <ul className="mt-3 flex flex-col gap-1.5 text-[0.95rem] text-ink">
                  <li className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                    <span className="font-semibold text-ink-soft">
                      {t("farm.ndviMean")}
                    </span>
                    <span className="font-extrabold text-ink">
                      {stats.ndviMean?.toFixed(2)}
                    </span>
                  </li>
                  {stats.ndviPrevMean !== null ? (
                    <li className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                      <span className="font-semibold text-ink-soft">
                        {t("farm.ndviPrev")} ({stats.prevObsDate})
                      </span>
                      <span className="font-extrabold text-ink">
                        {stats.ndviPrevMean.toFixed(2)}
                        {stats.ndviDelta !== null ? (
                          <span className={stats.ndviDelta < 0 ? "text-danger" : "text-success"}>
                            {" "}
                            {stats.ndviDelta < 0 ? "▼" : "▲"} {Math.abs(stats.ndviDelta).toFixed(2)}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ) : null}
                  {stats.cloudPct !== null ? (
                    <li className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                      <span className="font-semibold text-ink-soft">
                        {t("farm.cloudOverField")}
                      </span>
                      <span className="font-extrabold text-ink">{stats.cloudPct}%</span>
                    </li>
                  ) : null}
                </ul>
              ) : null}

              {agro && agro.ok && agro.ndviLatest ? (
                <div className="mt-3 rounded-2xl border border-earth/15 bg-bg p-3">
                  <h4 className="flex items-center gap-1.5 text-[0.92rem] font-extrabold text-ink">
                    <SatelliteIcon size={16} className="text-primary" />
                    {t("farm.agroNdviTitle")}
                  </h4>
                  <ul className="mt-2 flex flex-col gap-1.5 text-[0.95rem] text-ink">
                    <li className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink-soft">{t("farm.agroNdviMean")}</span>
                      <span className="font-extrabold text-ink">
                        {isNum(agro.ndviLatest.mean) ? fmt2(agro.ndviLatest.mean) : t("farm.noData")}
                      </span>
                    </li>
                    {isNum(agro.ndviLatest.median) ? (
                      <li className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink-soft">{t("farm.agroNdviMedian")}</span>
                        <span className="font-extrabold text-ink">{fmt2(agro.ndviLatest.median)}</span>
                      </li>
                    ) : null}
                    {agro.ndviPrev && isNum(agro.ndviPrev.mean) ? (
                      <li className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink-soft">
                          {t("farm.ndviPrev")} ({formatObsDate(agro.ndviPrev.dt, lang)})
                        </span>
                        <span className="font-extrabold text-ink">
                          {fmt2(agro.ndviPrev.mean)}
                          {isNum(agro.ndviLatest.mean) ? (
                            <span className={agro.ndviLatest.mean < agro.ndviPrev.mean ? "text-danger" : "text-success"}>
                              {" "}
                              {agro.ndviLatest.mean < agro.ndviPrev.mean ? "▼" : "▲"}{" "}
                              {Math.abs(agro.ndviLatest.mean - agro.ndviPrev.mean).toFixed(2)}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ) : null}
                    <li className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink-soft">{t("farm.agroObsDate")}</span>
                      <span className="font-extrabold text-ink">
                        {formatObsDate(agro.ndviLatest.dt, lang)} ({t("farm.sourceShort", { s: satelliteShort(agro.ndviLatest.source) })})
                      </span>
                    </li>
                  </ul>
                  <p className="mt-2 px-1 text-[0.85rem] font-medium text-ink-soft">
                    {t("farm.agroEstimateNote")}
                  </p>
                </div>
              ) : null}
              {agro && agro.ok && agro.soil ? (
                <div className="mt-2 rounded-2xl border border-earth/15 bg-bg p-3">
                  <h4 className="flex items-center gap-1.5 text-[0.92rem] font-extrabold text-ink">
                    <DropletIcon size={16} className="text-primary" />
                    {t("farm.agroSoilTitle")}
                  </h4>
                  <ul className="mt-2 flex flex-col gap-1.5 text-[0.95rem] text-ink">
                    {isNum(agro.soil.moistureM3) ? (
                      <li className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink-soft">{t("farm.agroSoilMoisture")}</span>
                        <span className="font-extrabold text-ink">{fmt0(agro.soil.moistureM3 * 100)}%</span>
                      </li>
                    ) : null}
                    {isNum(agro.soil.t0K) ? (
                      <li className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink-soft">{t("farm.agroSoilTemp")}</span>
                        <span className="font-extrabold text-ink">{fmt0(agro.soil.t0K - 273.15)}°C</span>
                      </li>
                    ) : null}
                  </ul>
                  <p className="mt-2 px-1 text-[0.85rem] font-medium text-ink-soft">
                    {t("farm.agroSoilNote")} · {t("farm.sourceAgroMonitoring")}
                  </p>
                </div>
              ) : null}

              <p className="mt-3 rounded-2xl border border-dashed border-earth/30 bg-earth-light/50 px-3 py-2.5 text-[0.9rem] font-medium leading-relaxed text-ink">
                {t("farm.satelliteHonesty")}
              </p>
            </>
          ) : (
            <p className="text-[0.98rem] font-semibold leading-relaxed text-ink-soft">
              {t("farm.cropHealthWaiting")}
            </p>
          )}
        </div>
      </section>

      {/* WHAT SHOULD YOU DO */}
      <section id="advice" className="scroll-mt-4">
        <SectionTitle icon={<CheckIcon size={20} />} text={t("farm.adviceTitle")} />
        <div className="card">
          {outcome ? (
            <p className="rounded-2xl bg-primary-light px-3 py-2.5 text-[1rem] font-semibold leading-relaxed text-ink">
              {t(outcome.cards.waterNeed.key, outcome.cards.waterNeed.params)}
            </p>
          ) : null}
          <ul className="mt-3 flex flex-col gap-2">
            {actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-[0.85rem] font-extrabold text-primary">
                  {i + 1}
                </span>
                <span className="text-[1rem] leading-relaxed text-ink">{a.message}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 px-1 text-[0.85rem] font-medium text-ink-soft">
            {t("farm.soilMoistureNote")}
          </p>
        </div>
      </section>

      {/* WARNINGS — important only */}
      <section id="warnings" className="scroll-mt-4">
        <SectionTitle icon={<InfoIcon size={20} />} text={t("weather.warningsTitle")} />
        {importantWarnings.length > 0 ? (
          <div className="flex flex-col gap-2">
            {importantWarnings.map((w, i) => (
              <WeatherWarningBanner key={i} severity={w.severity} message={w.message} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-success-light p-3 text-center text-[0.98rem] font-bold text-success">
            {t("weather.noWarnings")}
          </p>
        )}
        {infoNotes.length > 0 ? (
          <p className="mt-2 rounded-2xl bg-info-light px-3 py-2 text-[0.9rem] font-medium leading-relaxed text-info">
            {infoNotes.map((n) => n.message).join(" · ")}
          </p>
        ) : null}
      </section>

      {/* DETAILS — data transparency */}
      <section>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
        >
          <InfoIcon size={18} />
          {showDetails ? t("farm.hideDetails") : t("farm.showDetails")}
        </button>
        {showDetails ? (
          <div className="card mt-2 text-[0.9rem] leading-relaxed text-ink">
            <h3 className="text-[0.95rem] font-extrabold text-ink">
              {t("farm.detailsTitle")}
            </h3>
            <dl className="mt-2 flex flex-col gap-1.5">
              <DetailRow label={t("farm.dWeatherSource")} value={`${t("farm.sourceOpenMeteo")} · ${t("farm.updatedAt")} ${updatedLabel}`} />
              <DetailRow label={t("farm.dBasemap")} value={`${t("farm.sourceEsri")} (${t("farm.satelliteLabelShort")})`} />
              {status?.ndvi ? (
                <DetailRow
                  label={t("farm.dNdvi")}
                  value={`NASA GIBS · ${status.ndvi.product} · ${status.ndvi.date}${status.ndvi.daysAgo > 0 ? ` (${t("farm.satelliteDaysAgo", { days: String(status.ndvi.daysAgo) })})` : ""} · ${status.ndvi.periodDays}-day composite`}
                />
              ) : (
                <DetailRow label={t("farm.dNdvi")} value={t("farm.satelliteUnavailable")} />
              )}
              {stats ? (
                <>
                  <DetailRow
                    label={t("farm.dNdviValue")}
                    value={
                      stats.ndviMean !== null
                        ? `${stats.ndviMean.toFixed(3)} (${stats.validPixels} ${t("farm.pixels")}${stats.ndviPrevMean !== null ? `, ${t("farm.prevObs")} ${stats.ndviPrevMean.toFixed(3)}` : ""})`
                        : t("farm.noData")
                    }
                  />
                  {stats.cloudPct !== null && status?.cloud ? (
                    <DetailRow label={t("farm.dCloud")} value={`${stats.cloudPct}% · ${status.cloud.product} · ${status.cloud.date}`} />
                  ) : null}
                </>
              ) : null}
              <DetailRow label={t("farm.dCopernicus")} value={status?.copernicus.note ?? t("farm.noData")} />
              <DetailRow
                label={t("farm.dAgro")}
                value={
                  agro?.configured
                    ? agro.ok
                      ? `${t("farm.sourceAgroMonitoring")} · ${t("farm.agroPolyId")} ${agro.polyId ?? t("farm.noData")}${agro.ndviLatest ? ` · ${t("farm.agroObsDate")} ${formatObsDate(agro.ndviLatest.dt, lang)}` : ""}`
                      : `${t("farm.sourceAgroMonitoring")} · ${t("farm.agroUnavailable")}`
                    : `${t("farm.sourceAgroMonitoring")} · ${t("farm.agroNotConfigured")}`
                }
              />
              {agro?.ok && agro.soil ? (
                <DetailRow
                  label={t("farm.dAgroSoil")}
                  value={`${t("farm.agroSoilMoisture")} ${isNum(agro.soil.moistureM3) ? fmt0(agro.soil.moistureM3 * 100) + "%" : t("farm.noData")} · ${t("farm.agroSoilTemp")} ${isNum(agro.soil.t0K) ? fmt0(agro.soil.t0K - 273.15) + "°C" : t("farm.noData")} · ${formatObsDate(agro.soil.dt, lang)}`}
                />
              ) : null}
              {farm.polygon?.areaM2 ? (
                <DetailRow
                  label={t("farm.dArea")}
                  value={`${(farm.polygon.areaM2 / 10000).toFixed(2)} ha · ${farm.lat.toFixed(5)}, ${farm.lon.toFixed(5)}`}
                />
              ) : null}
            </dl>
            <p className="mt-3 border-t border-earth/10 pt-2 text-[0.85rem] font-medium text-ink-soft">
              {t("farm.satelliteHonesty")}
            </p>
          </div>
        ) : null}
      </section>

      <p className="px-2 text-center text-[0.9rem] font-medium leading-relaxed text-ink-soft">
        {t("common.expertLine")}
      </p>
    </div>
  );
}

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-[1.06rem] font-extrabold text-ink">
      <span className="text-primary">{icon}</span>
      {text}
    </h2>
  );
}

function QuickCard({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-earth/25 bg-surface px-3.5 text-[0.9rem] font-bold text-ink transition-colors hover:border-primary/40 hover:bg-primary-light/50"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  );
}

function Metric({
  label,
  value,
  icon,
  tint = "text-ink",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tint?: string;
}) {
  return (
    <div className="stat-pill">
      <dt className="sr-only">{label}</dt>
      <dd className={`inline-flex items-center justify-center gap-1 text-[1rem] font-extrabold ${tint}`}>
        {icon}
        {value}
      </dd>
      <p className="mt-0.5 text-[0.78rem] font-semibold text-ink-soft">{label}</p>
    </div>
  );
}

function formatObsDate(unixS: number, lang: string): string {
  return new Date(unixS * 1000).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function satelliteShort(source: string): string {
  const s = source.toLowerCase();
  if (s === "l8" || s.includes("landsat")) return "Landsat-8";
  if (s === "s2" || s.includes("sentinel")) return "Sentinel-2";
  return source;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-bg px-3 py-2">
      <dt className="text-[0.78rem] font-bold uppercase tracking-wide text-ink-soft">
        {label}
      </dt>
      <dd className="text-[0.9rem] font-semibold text-ink">{value}</dd>
    </div>
  );
}