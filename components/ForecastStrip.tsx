"use client";

import { useMemo } from "react";
import type { ForecastDay } from "@/lib/types";
import { useI18n } from "@/lib/I18nProvider";
import SkyIcon from "./SkyIcon";
import { DropletIcon } from "./icons";

function iconTint(group: string): string {
  if (group === "rain" || group === "storm" || group === "snow")
    return "text-info";
  if (group === "clear") return "text-warning";
  return "text-earth";
}

/** Forecast strip (§13): today + next 6 days, day name in the active language. */
export default function ForecastStrip({ days }: { days: ForecastDay[] }) {
  const { dict, t } = useI18n();

  const labeled = useMemo(
    () =>
      days.map((d, i) => {
        let label: string;
        if (i === 0) {
          label = t("weather.dayToday");
        } else {
          const dt = new Date(`${d.date}T12:00:00`);
          const wd = Number.isNaN(dt.getTime()) ? 0 : dt.getDay();
          label = dict.weather.days[wd] ?? "";
        }
        return { ...d, label };
      }),
    [days, dict, t]
  );

  return (
    <div className="card-sm">
      <h2 className="mb-2 text-[1.06rem] font-extrabold text-ink">
        {t("weather.forecastTitle")}
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-1" role="list">
        {labeled.map((d) => (
          <li
            key={d.date}
            className={`flex min-w-[86px] flex-col items-center gap-1 rounded-2xl px-2 py-3 ${
              d.label === t("weather.dayToday")
                ? "bg-primary-light"
                : "bg-bg"
            }`}
          >
            <span className="text-[0.85rem] font-bold text-ink-soft">
              {d.label}
            </span>
            <span className={iconTint(d.group)}>
              <SkyIcon group={d.group} size={30} />
            </span>
            <span className="text-[0.98rem] font-extrabold text-ink">
              {d.tMax}°
              <span className="font-semibold text-ink-soft">/{d.tMin}°</span>
            </span>
            {typeof d.precipProb === "number" && d.precipProb > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-[0.78rem] font-semibold text-info">
                <DropletIcon size={12} />
                {d.precipProb}%
              </span>
            ) : (
              <span className="text-[0.78rem]">&nbsp;</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
