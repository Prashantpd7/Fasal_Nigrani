"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PageShell from "@/components/PageShell";
import LocationPicker, { type GeoPick } from "@/components/LocationPicker";
import WeatherSummaryCard from "@/components/WeatherSummaryCard";
import WeatherWarningBanner from "@/components/WeatherWarningBanner";
import ForecastStrip from "@/components/ForecastStrip";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import {
  CheckIcon,
  MapPinIcon,
  RefreshIcon,
  InfoIcon,
} from "@/components/icons";
import { useI18n } from "@/lib/I18nProvider";
import { cacheWeather, readCachedWeather } from "@/lib/clientStore";
import type { WeatherPayload } from "@/lib/types";

interface LoadedResult {
  place: GeoPick;
  weather: WeatherPayload;
  stale: boolean;
}

export default function WeatherPage() {
  const { t, lang } = useI18n();
  const [pending, setPending] = useState<GeoPick | null>(null);
  const [result, setResult] = useState<LoadedResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeRef = useRef<GeoPick | null>(null);

  const load = useCallback(
    async (place: GeoPick) => {
      placeRef.current = place;
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          lat: String(place.lat),
          lon: String(place.lon),
          lang,
          place: place.key,
          location: place.label,
        });
        const res = await fetch(`/api/weather?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
        const payload = (await res.json()) as WeatherPayload;
        cacheWeather(place.key, lang, payload);
        setResult({ place, weather: payload, stale: false });
      } catch {
        // Offline degradation (§28): prefer the last successful snapshot for
        // this place, clearly labelled stale — but only if it is in the
        // current language, so we never mix Hindi/English UI.
        const cached = readCachedWeather(place.key);
        if (cached && cached.lang === lang) {
          setResult({
            place,
            weather: cached.payload,
            stale: true,
          });
        } else {
          setError(t("errors.network"));
        }
      } finally {
        setBusy(false);
      }
    },
    [lang, t]
  );

  // If the farmer switches language while viewing results, refetch so every
  // rule-engine sentence arrives in the new language (§16).
  useEffect(() => {
    if (placeRef.current && !pending) {
      void load(placeRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  if (pending) {
    // Confirmation over ambiguity (§9): show what was captured before acting.
    return (
      <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
        <section className="card text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
            <MapPinIcon size={30} />
          </span>
          <h2 className="mt-3 text-[1.25rem] font-extrabold text-ink">
            {pending.label}
          </h2>
          <p className="mt-1 text-[0.98rem] text-ink-soft">
            {t("weather.confirmSubtitle")}
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                const p = pending;
                setPending(null);
                void load(p);
              }}
            >
              <CheckIcon size={20} />
              {t("weather.confirmYes")}
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setPending(null)}
            >
              {t("weather.changeLocation")}
            </button>
          </div>
        </section>
      </PageShell>
    );
  }

  if (busy) {
    return (
      <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
        <LoadingState message={t("weather.checking")} />
      </PageShell>
    );
  }

  if (error && !result) {
    return (
      <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
        <ErrorState message={error} onRetry={() => placeRef.current && void load(placeRef.current)} />
        <LocationPicker
          onPick={(p) => setPending(p)}
        />
      </PageShell>
    );
  }

  if (!result) {
    return (
      <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
        <LocationPicker onPick={(p) => setPending(p)} />
      </PageShell>
    );
  }

  const { weather, stale } = result;
  return (
    <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
      <WeatherSummaryCard weather={weather} stale={stale} />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setResult(null);
            setPending(null);
            placeRef.current = null;
          }}
        >
          <MapPinIcon size={18} />
          {t("weather.changeLocation")}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => placeRef.current && void load(placeRef.current)}
        >
          <RefreshIcon size={18} />
          {t("weather.refresh")}
        </button>
      </div>

      {/* Warnings (colour-coded: red only for urgent) */}
      {weather.warnings.length > 0 ? (
        <section aria-label={t("weather.warningsTitle")}>
          <h2 className="mb-2 flex items-center gap-2 text-[1.08rem] font-extrabold text-ink">
            <InfoIcon size={20} className="text-warning" />
            {t("weather.warningsTitle")}
          </h2>
          <div className="flex flex-col gap-2">
            {weather.warnings.map((w, i) => (
              <WeatherWarningBanner key={i} severity={w.severity} message={w.message} />
            ))}
          </div>
        </section>
      ) : (
        <p className="rounded-2xl bg-success-light p-3 text-center text-[0.98rem] font-bold text-success">
          {t("weather.noWarnings")}
        </p>
      )}

      {/* Today's actions */}
      <section className="card">
        <h2 className="mb-2.5 flex items-center gap-2 text-[1.08rem] font-extrabold text-primary">
          <CheckIcon size={20} />
          {t("weather.actionsTitle")}
        </h2>
        <ul className="flex flex-col gap-2">
          {weather.actions.map((action, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-[0.85rem] font-extrabold text-primary">
                {i + 1}
              </span>
              <span className="text-[1rem] leading-relaxed text-ink">
                {action}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ForecastStrip days={weather.forecast} />

      {/* Demo / expert honesty line */}
      <p className="px-2 text-center text-[0.9rem] font-medium leading-relaxed text-ink-soft">
        {t("common.expertLine")}
      </p>
    </PageShell>
  );
}
