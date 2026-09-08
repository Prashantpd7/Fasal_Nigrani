"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import PageShell from "@/components/PageShell";
import LocationPicker, { type GeoPick } from "@/components/LocationPicker";
import CropPicker from "@/components/farm/CropPicker";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { CheckIcon, MapPinIcon, InfoIcon } from "@/components/icons";
import { useI18n } from "@/lib/I18nProvider";
import {
  cacheAgroMonitoring,
  cacheAgroPolyId,
  cacheFarmState,
  cacheWeather,
  readCachedAgroMonitoring,
  readCachedAgroPolyId,
  readCachedFarmState,
  readCachedWeather,
} from "@/lib/clientStore";
import { cacheSatelliteStatus, readCachedSatelliteStatus } from "@/lib/clientStore";
import { computeSatelliteStats } from "@/lib/satelliteStats";
import { polygonAreaM2 } from "@/lib/farmGeometry";
import { cropById, cropName } from "@/lib/crops";
import type {
  AgroMonitoringData,
  AgroRegisterResult,
  CropId,
  FarmPolygon,
  FarmState,
  SatelliteStats,
  SatelliteStatus,
  WeatherPayload,
} from "@/lib/types";

// Leaflet must never run on the server — lazy-load both map + dashboard.
function MapLoading() {
  const { t } = useI18n();
  return <LoadingState message={t("farm.checking")} />;
}

const FarmMap = dynamic(() => import("@/components/farm/FarmMap"), {
  ssr: false,
  loading: MapLoading,
});
const FarmDashboard = dynamic(() => import("@/components/farm/FarmDashboard"), {
  ssr: false,
  loading: MapLoading,
});

type Step = "location" | "confirm" | "field" | "crop" | "dashboard";

interface LoadedResult {
  place: GeoPick;
  weather: WeatherPayload;
  stale: boolean;
}

export default function WeatherPage() {
  const { t, lang } = useI18n();
  const [step, setStep] = useState<Step>("location");
  const [pending, setPending] = useState<GeoPick | null>(null);
  const [place, setPlace] = useState<GeoPick | null>(null);
  const [farm, setFarm] = useState<FarmState | null>(null);
  const [result, setResult] = useState<LoadedResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeRef = useRef<GeoPick | null>(null);

  const [status, setStatus] = useState<SatelliteStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusFailed, setStatusFailed] = useState(false);
  const [stats, setStats] = useState<SatelliteStats | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);
  const runStatsRef = useRef<AbortController | null>(null);

  // AgroMonitoring: real field-level monitoring (NDVI history, imagery, soil).
  const [agro, setAgro] = useState<AgroMonitoringData | null>(null);
  const [agroBusy, setAgroBusy] = useState(false);
  const [agroFailed, setAgroFailed] = useState(false);
  const agroRef = useRef<AbortController | null>(null);

  /** Register the drawn field with AgroMonitoring once, then fetch monitoring. */
  const loadAgroMonitoring = useCallback(
    async (st: FarmState) => {
      if (!st.polygon || st.polygon.ring.length < 3 || !st.crop) {
        setAgro(null);
        return;
      }
      agroRef.current?.abort();
      const ctrl = new AbortController();
      agroRef.current = ctrl;
      setAgroBusy(true);
      setAgroFailed(false);

      // A fresh cached payload is good enough — do not hammer the API.
      const cached = readCachedAgroMonitoring(st.key);
      if (cached && cached.polyId) {
        setAgro(cached);
        setAgroBusy(false);
        return;
      }

      try {
        // 1) Register (or reuse) the AgroMonitoring polygon for this farm.
        let polyId = readCachedAgroPolyId(st.key);
        if (!polyId) {
          const regRes = await fetch("/api/agromonitoring", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: `Fasal Nigrani — ${st.label}`,
              ring: st.polygon.ring,
            }),
            signal: ctrl.signal,
          });
          const reg = (await regRes.json().catch(() => null)) as AgroRegisterResult | null;
          if (!reg?.ok || !reg.polyId) {
            setAgroFailed(true);
            setAgro(null);
            return;
          }
          polyId = reg.polyId;
          cacheAgroPolyId(st.key, polyId);
        }
        // 2) Fetch real monitoring data for the polygon.
        const res = await fetch(`/api/agromonitoring?polyid=${encodeURIComponent(polyId)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => null)) as AgroMonitoringData | null;
        if (ctrl.signal.aborted) return;
        if (!data || !data.ok) {
          setAgroFailed(true);
          setAgro(null);
          return;
        }
        cacheAgroMonitoring(st.key, data);
        setAgro(data);
      } catch {
        if (!ctrl.signal.aborted) {
          setAgroFailed(true);
          setAgro(null);
        }
      } finally {
        if (!ctrl.signal.aborted) setAgroBusy(false);
      }
    },
    []
  );

  // Restore a previously saved farm on mount (location + field + crop).
  useEffect(() => {
    const saved = readCachedFarmState();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration sync of an external preference (localStorage); no cascading updates.
      setFarm(saved);
      const savedPlace: GeoPick = {
        key: saved.key,
        label: saved.label,
        lat: saved.lat,
        lon: saved.lon,
      };
      setPlace(savedPlace);
      placeRef.current = savedPlace;
      // Weather cache (same-language) restores the dashboard instantly.
      const cached = readCachedWeather(saved.key);
      if (cached && cached.lang === lang) {
        setResult({ place: savedPlace, weather: cached.payload, stale: cached.stale });
        setStep("dashboard");
      } else {
        setStep("dashboard");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWeather = useCallback(
    async (p: GeoPick) => {
      placeRef.current = p;
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          lat: String(p.lat),
          lon: String(p.lon),
          lang,
          place: p.key,
          location: p.label,
        });
        const res = await fetch(`/api/weather?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
        const payload = (await res.json()) as WeatherPayload;
        cacheWeather(p.key, lang, payload);
        setResult({ place: p, weather: payload, stale: false });
      } catch {
        const cached = readCachedWeather(p.key);
        if (cached && cached.lang === lang) {
          setResult({ place: p, weather: cached.payload, stale: true });
        } else {
          setError(t("errors.network"));
        }
      } finally {
        setBusy(false);
      }
    },
    [lang, t]
  );

  const loadSatelliteStatus = useCallback(async () => {
    setStatusBusy(true);
    setStatusFailed(false);
    try {
      const cached = readCachedSatelliteStatus();
      if (cached) {
        setStatus(cached);
        setStatusBusy(false);
        return;
      }
      const res = await fetch("/api/satellite/status", { cache: "no-store" });
      const data = (await res.json()) as SatelliteStatus;
      if (!res.ok || !data || !data.ok) throw new Error("satellite status");
      cacheSatelliteStatus(data);
      setStatus(data);
    } catch {
      setStatusFailed(true);
      setStatus(null);
    } finally {
      setStatusBusy(false);
    }
  }, []);

  const runStats = useCallback(async (st: SatelliteStatus | null, ring: [number, number][]) => {
    runStatsRef.current?.abort();
    const ctrl = new AbortController();
    runStatsRef.current = ctrl;
    if (!st?.ok || !st.ndvi || ring.length < 3) {
      setStats(null);
      return;
    }
    setStatsBusy(true);
    const s = await computeSatelliteStats(st, ring, ctrl.signal);
    if (!ctrl.signal.aborted) {
      setStats(s);
      setStatsBusy(false);
    }
  }, []);

  // Refresh weather + satellite whenever the dashboard opens.
  useEffect(() => {
    if (step === "dashboard" && placeRef.current) {
      void loadWeather(placeRef.current);
      void loadSatelliteStatus();
    }
  }, [step, loadWeather, loadSatelliteStatus]);

  // Re-measure when satellite status or the polygon changes. The measurement
  // reads external satellite tiles — async by nature, never a cascading render.
  useEffect(() => {
    if (step === "dashboard" && farm?.polygon?.ring && farm.polygon.ring.length >= 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async external-data sync; setState happens after awaited tile fetches.
      void runStats(status, farm.polygon.ring);
    }
  }, [step, status, farm?.polygon?.ring, runStats]);

  // AgroMonitoring: register the field + fetch real monitoring when the
  // dashboard opens with a drawn field and a chosen crop.
  useEffect(() => {
    if (step === "dashboard" && farm?.polygon?.ring && farm.polygon.ring.length >= 3 && farm.crop) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async external-data sync; setState happens after awaited API calls.
      void loadAgroMonitoring(farm);
    }
  }, [step, farm, loadAgroMonitoring]);

  // Language switch: refetch so every rule sentence is in the new language.
  useEffect(() => {
    if (placeRef.current && (step === "dashboard" || step === "confirm")) {
      void loadWeather(placeRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const setPolygon = useCallback(
    (ring: [number, number][]) => {
      setFarm((prev) => {
        const base = prev ?? {
          key: placeRef.current?.key ?? "farm",
          label: placeRef.current?.label ?? "",
          lat: placeRef.current?.lat ?? 0,
          lon: placeRef.current?.lon ?? 0,
          polygon: null,
          crop: null,
          cropLabel: null,
        };
        const next: FarmState = {
          ...base,
          polygon: { ring, areaM2: polygonAreaM2(ring) } satisfies FarmPolygon,
        };
        cacheFarmState(next);
        return next;
      });
    },
    []
  );

  const setCrop = useCallback((crop: CropId, cropLabel: string) => {
    setFarm((prev) => {
      const base = prev ?? {
        key: placeRef.current?.key ?? "farm",
        label: placeRef.current?.label ?? "",
        lat: placeRef.current?.lat ?? 0,
        lon: placeRef.current?.lon ?? 0,
        polygon: null,
        crop: null,
        cropLabel: null,
      };
      const next: FarmState = { ...base, crop, cropLabel };
      cacheFarmState(next);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------- location
  if (step === "location") {
    return (
      <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
        <LocationPicker
          onPick={(p) => {
            setPending(p);
            setStep("confirm");
          }}
        />
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- confirm
  if (step === "confirm" && pending) {
    return (
      <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
        <section className="card text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
            <MapPinIcon size={30} />
          </span>
          <h2 className="mt-3 text-[1.25rem] font-extrabold text-ink">{pending.label}</h2>
          <p className="mt-1 text-[0.98rem] text-ink-soft">{t("weather.confirmSubtitle")}</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                setPlace(pending);
                placeRef.current = pending;
                setFarm((prev) => ({
                  key: pending.key,
                  label: pending.label,
                  lat: pending.lat,
                  lon: pending.lon,
                  polygon: prev?.key === pending.key ? prev.polygon : null,
                  crop: prev?.key === pending.key ? prev.crop : null,
                  cropLabel: prev?.key === pending.key ? prev.cropLabel : null,
                }));
                setStep("field");
              }}
            >
              <CheckIcon size={20} />
              {t("weather.confirmYes")}
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setStep("location")}>
              {t("weather.changeLocation")}
            </button>
          </div>
        </section>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- field
  if (step === "field" && place) {
    return (
      <PageShell title={t("farm.fieldTitle")} subtitle={t("farm.fieldSubtitle")} backHref="/">
        <FarmMap
          center={{ lat: place.lat, lon: place.lon }}
          status={status}
          polygon={farm?.polygon ?? null}
          onPolygonChange={setPolygon}
          height={380}
          editable
        />
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            className="btn-primary w-full"
            disabled={(farm?.polygon?.ring.length ?? 0) < 3}
            onClick={() => setStep("crop")}
          >
            <CheckIcon size={20} />
            {t("farm.nextCrop")}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep("crop")}>
            {t("farm.skipField")}
          </button>
        </div>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- crop
  if (step === "crop" && place) {
    return (
      <PageShell title={t("farm.cropTitle")} subtitle={t("farm.cropSubtitle")} backHref="/">
        <CropPicker
          selected={farm?.crop ?? null}
          onSelect={(id) => {
            const rec = cropById(id);
            setCrop(id, rec ? cropName(rec, lang) : "");
          }}
        />
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!farm?.crop}
            onClick={() => setStep("dashboard")}
          >
            {t("farm.openDashboard")}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep("field")}>
            {t("weather.changeLocation")}
          </button>
        </div>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- dashboard
  if (busy && !result) {
    return (
      <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
        <LoadingState message={t("weather.checking")} />
      </PageShell>
    );
  }

  if (error && !result) {
    return (
      <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
        <ErrorState message={error} onRetry={() => placeRef.current && void loadWeather(placeRef.current)} />
        <LocationPicker onPick={(p) => setPending(p)} />
      </PageShell>
    );
  }

  if (!result || !farm) {
    return (
      <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
        <LocationPicker onPick={(p) => setPending(p)} />
      </PageShell>
    );
  }

  return (
    <PageShell title={t("weather.title")} subtitle={t("weather.subtitle")} backHref="/">
      <FarmDashboard
        farm={farm}
        weather={result.weather}
        stale={result.stale}
        status={status}
        statusBusy={statusBusy}
        statusFailed={statusFailed}
        stats={stats}
        statsBusy={statsBusy}
        agro={agro}
        agroBusy={agroBusy}
        agroFailed={agroFailed}
        onRefreshWeather={() => placeRef.current && void loadWeather(placeRef.current)}
        onRefreshSatellite={() => {
          setStatus(null);
          void loadSatelliteStatus();
        }}
        onRefreshAgro={() => {
          cacheAgroMonitoring(farm.key, { ...agro, fetchedAt: 0 } as AgroMonitoringData);
          void loadAgroMonitoring(farm);
        }}
        onEditField={() => setStep("field")}
        onEditCrop={() => setStep("crop")}
      />
      {statusFailed ? (
        <p className="flex items-start gap-2 rounded-2xl border border-dashed border-warning/40 bg-warning-light p-3 text-[0.9rem] font-semibold leading-relaxed text-warning">
          <InfoIcon size={18} className="mt-0.5 shrink-0" />
          {t("farm.satelliteSourceDown")}
        </p>
      ) : null}
    </PageShell>
  );
}