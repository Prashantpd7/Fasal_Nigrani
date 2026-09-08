"use client";

import type { WeatherPayload } from "@/lib/types";
import { useI18n } from "@/lib/I18nProvider";
import SkyIcon from "./SkyIcon";
import { SourceChip, StaleChip } from "./shared/DataChip";
import { MapPinIcon, DropletIcon, WindIcon } from "./icons";

function tintFor(group: string): string {
  if (group === "clear") return "bg-warning-light text-warning";
  if (group === "rain" || group === "storm" || group === "snow")
    return "bg-info-light text-info";
  if (group === "fog") return "bg-earth-light text-earth";
  return "bg-primary-light text-primary";
}

/** §13 WeatherSummaryCard: (a) today's one-line summary in large text, with
 *  current humidity/wind details and provenance chips (live/demo/stale). */
export default function WeatherSummaryCard({
  weather,
  stale = false,
}: {
  weather: WeatherPayload;
  stale?: boolean;
}) {
  const { t, dict } = useI18n();
  const rainToday =
    weather.forecast.length > 0 ? weather.forecast[0].precipProb : null;
  return (
    <section className="card" aria-label={t("weather.title")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[0.98rem] font-bold text-primary">
          <MapPinIcon size={18} />
          {weather.locationName}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {stale ? <StaleChip /> : null}
          <SourceChip source={weather.source} />
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <span
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl ${tintFor(
            weather.current.group
          )}`}
        >
          <SkyIcon group={weather.current.group} size={46} />
        </span>
        <div className="min-w-0">
          <p className="text-[1.28rem] font-extrabold leading-snug text-ink">
            {weather.summary}
          </p>
          <p className="mt-0.5 text-[0.95rem] text-ink-soft">
            {weather.nowLine}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div className="stat-pill">
          <dt className="sr-only">{dict.weather.humidityPct}</dt>
          <dd className="inline-flex items-center gap-1 text-[1.05rem] font-extrabold text-info">
            <DropletIcon size={18} />
            {weather.current.humidity}%
          </dd>
        </div>
        <div className="stat-pill">
          <dt className="sr-only">{dict.weather.windKmh}</dt>
          <dd className="inline-flex items-center gap-1 text-[1.05rem] font-extrabold text-earth">
            <WindIcon size={18} />
            {weather.current.windKmh}
            <span className="text-[0.78rem] font-bold">km/h</span>
          </dd>
        </div>
        <div className="stat-pill">
          <dt className="sr-only">{dict.weather.rainProb}</dt>
          <dd
            className={`inline-flex items-center gap-1 text-[1.05rem] font-extrabold ${
              rainToday !== null && rainToday >= 60
                ? "text-danger"
                : "text-ink"
            }`}
          >
            <SkyIcon group="rain" size={18} />
            {rainToday !== null ? `${rainToday}%` : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
