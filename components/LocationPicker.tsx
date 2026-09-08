"use client";

import { useMemo, useRef, useState } from "react";
import { GEO_PLACES, kmDistance, placeName, stateName } from "@/lib/geo";
import { useI18n } from "@/lib/I18nProvider";
import {
  MapPinIcon,
  SearchIcon,
  ChevronRightIcon,
  InfoIcon,
} from "./icons";

export interface GeoPick {
  /** Stable key used for weather caching. */
  key: string;
  /** Localized display name, e.g. "Barmer, Rajasthan". */
  label: string;
  lat: number;
  lon: number;
}

/**
 * Flow A (§8): geolocation is attempted first, but denial/absence NEVER
 * dead-ends the farmer — a searchable Rajasthan-first district list is always
 * right below.
 */
export default function LocationPicker({
  onPick,
}: {
  onPick: (place: GeoPick) => void;
}) {
  const { t, lang } = useI18n();
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [query, setQuery] = useState("");
  const locatingRef = useRef(false);

  const geolocate = () => {
    if (locatingRef.current) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDenied(true);
      return;
    }
    locatingRef.current = true;
    setLocating(true);
    setDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locatingRef.current = false;
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        // Snap to the nearest known district for a friendly label, but keep
        // the precise coordinates for the actual forecast.
        let nearest = GEO_PLACES[0];
        let nearestKm = Infinity;
        for (const p of GEO_PLACES) {
          const d = kmDistance(latitude, longitude, p.lat, p.lon);
          if (d < nearestKm) {
            nearestKm = d;
            nearest = p;
          }
        }
        const useLabel =
          nearestKm < 300
            ? `${placeName(nearest, lang)}, ${stateName(nearest, lang)}`
            : lang === "hi"
              ? "आपका इलाका"
              : "Your area";
        onPick({
          key: nearestKm < 300 ? nearest.id : `custom-${Math.round(latitude)}-${Math.round(longitude)}`,
          label: useLabel,
          lat: latitude,
          lon: longitude,
        });
      },
      () => {
        locatingRef.current = false;
        setLocating(false);
        setDenied(true);
      },
      { timeout: 12_000, maximumAge: 60_000 }
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GEO_PLACES;
    return GEO_PLACES.filter(
      (p) =>
        p.en.toLowerCase().includes(q) ||
        p.hi.includes(q) ||
        p.stateEn.toLowerCase().includes(q) ||
        p.stateHi.includes(q)
    );
  }, [query]);

  return (
    <div className="card">
      <h2 className="flex items-center gap-2 text-[1.1rem] font-extrabold text-ink">
        <MapPinIcon size={20} className="text-primary" />
        {t("weather.locationTitle")}
      </h2>

      <button
        type="button"
        onClick={geolocate}
        disabled={locating}
        className="btn-primary mt-3 w-full"
      >
        <MapPinIcon size={20} />
        {locating ? t("weather.choosingLocation") : t("weather.useMyLocation")}
      </button>

      {denied ? (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-2xl bg-warning-light p-3 text-[0.95rem] font-medium leading-relaxed text-warning"
        >
          <InfoIcon size={18} className="mt-0.5 shrink-0" />
          {t("weather.geoDenied")}
        </p>
      ) : null}

      <label className="field-label mt-5" htmlFor="place-search">
        {t("weather.listTitle")}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft">
          <SearchIcon size={18} />
        </span>
        <input
          id="place-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.searchPlaceholder")}
          className="min-h-12 w-full rounded-2xl border border-earth/25 bg-bg px-4 py-2 pl-10 text-[1rem] text-ink placeholder:text-ink-soft/70 focus:border-primary"
        />
      </div>

      <ul
        className="mt-3 grid max-h-80 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2"
        aria-label={t("weather.listTitle")}
      >
        {filtered.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() =>
                onPick({
                  key: p.id,
                  label: `${placeName(p, lang)}, ${stateName(p, lang)}`,
                  lat: p.lat,
                  lon: p.lon,
                })
              }
              className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-transparent px-3 text-left transition-colors hover:border-earth/25 hover:bg-primary-light/40"
            >
              <span className="flex flex-col leading-tight">
                <span className="text-[1rem] font-bold text-ink">
                  {placeName(p, lang)}
                </span>
                <span className="text-[0.8rem] font-semibold text-ink-soft">
                  {stateName(p, lang)}
                </span>
              </span>
              <ChevronRightIcon size={16} className="shrink-0 text-earth/50" />
            </button>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="px-2 py-3 text-[0.95rem] text-ink-soft">
            {t("common.empty")}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
