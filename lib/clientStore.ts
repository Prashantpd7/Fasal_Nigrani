/**
 * Offline / poor-network degradation (§28) + cross-feature context.
 *  - last successful weather payload per place is cached and served with a
 *    stale-data note when a fresh fetch fails;
 *  - every cached item remembers the language it was localised in, so the
 *    chat feature never mixes Hindi/English context into an answer.
 *
 * All helpers are SSR-safe (client components also render on the server).
 */
import type { Lang } from "./i18n";
import type {
  AgroMonitoringData,
  FarmState,
  SatelliteStatus,
  WeatherPayload,
} from "./types";

const WEATHER_PREFIX = "fn-weather-";
const META_KEY = "fn-meta";
const FARM_KEY = "fn-farm";
const SAT_STATUS_KEY = "fn-sat-status";
const AGRO_KEY = "fn-agro-";
const STALE_MS = 1000 * 60 * 60 * 4; // 4h-old snapshot is still useful
const SAT_STATUS_TTL_MS = 1000 * 60 * 5; // satellite config is global + stable
const AGRO_TTL_MS = 1000 * 60 * 30; // monitoring snapshot is valid for 30 min

interface Meta {
  lastWeather?: { key: string; lang: Lang } | null;
  photo?: { summary: string; at: number; lang: Lang } | null;
}

function readMeta(): Meta {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as Meta) : {};
  } catch {
    return {};
  }
}

function writeMeta(meta: Meta): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — ignore */
  }
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Save a successful weather payload + the language it was rendered in. */
export function cacheWeather(
  placeKey: string,
  lang: Lang,
  payload: WeatherPayload
): void {
  safeSet(WEATHER_PREFIX + placeKey, JSON.stringify(payload));
  const meta = readMeta();
  meta.lastWeather = { key: placeKey, lang };
  writeMeta(meta);
}

export interface CachedWeather {
  payload: WeatherPayload;
  stale: boolean;
  lang: Lang;
}

export function readCachedWeather(placeKey: string): CachedWeather | null {
  const raw = safeGet(WEATHER_PREFIX + placeKey);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as WeatherPayload;
    if (!payload || typeof payload.summary !== "string") return null;
    const stale = Date.now() - payload.fetchedAt > STALE_MS;
    const meta = readMeta();
    const lang: Lang =
      meta.lastWeather?.key === placeKey && meta.lastWeather.lang
        ? meta.lastWeather.lang
        : "hi";
    return { payload, stale, lang };
  } catch {
    return null;
  }
}

/** Last checked place (used by chat for weather context). */
export function readLastWeather():
  | (CachedWeather & { key: string })
  | null {
  const meta = readMeta();
  if (!meta.lastWeather) return null;
  const cached = readCachedWeather(meta.lastWeather.key);
  if (!cached) return null;
  return { ...cached, key: meta.lastWeather.key };
}

// ---------------------------------------------------------------------------
// Last photo-check context (for the chat "ask something else" flow §8.8)
// ---------------------------------------------------------------------------

export interface PhotoContext {
  summary: string;
  at: number;
  lang: Lang;
  /** Extra crop-analysis context shared with the chatbot. */
  crop?: string | null;
  problem?: string | null;
  confidencePct?: number | null;
  source?: string | null;
  location?: string | null;
}

export function cachePhotoContext(ctx: PhotoContext): void {
  const meta = readMeta();
  meta.photo = ctx;
  writeMeta(meta);
}

export function readPhotoContext(): PhotoContext | null {
  const meta = readMeta();
  return meta.photo ?? null;
}

// ---------------------------------------------------------------------------
// Farm dashboard state (location + polygon + crop) — saved so a farmer never
// has to redraw their field after a reload or network drop (§ Farm).
// ---------------------------------------------------------------------------

export function cacheFarmState(state: FarmState): void {
  safeSet(FARM_KEY, JSON.stringify(state));
}

export function readCachedFarmState(): FarmState | null {
  const raw = safeGet(FARM_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as FarmState;
    if (!state || typeof state.label !== "string") return null;
    if (
      state.polygon &&
      (!Array.isArray(state.polygon.ring) || state.polygon.ring.length < 3)
    ) {
      state.polygon = null;
    }
    return state;
  } catch {
    return null;
  }
}

/** Satellite layer config (location-independent) — cached to avoid hammering. */
export function cacheSatelliteStatus(status: SatelliteStatus): void {
  safeSet(SAT_STATUS_KEY, JSON.stringify({ status, at: Date.now() }));
}

export function readCachedSatelliteStatus(): SatelliteStatus | null {
  const raw = safeGet(SAT_STATUS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { status: SatelliteStatus; at: number };
    if (!parsed?.status?.ndvi) return null;
    if (Date.now() - parsed.at > SAT_STATUS_TTL_MS) return null;
    return parsed.status;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// AgroMonitoring state — the AgroMonitoring polygon id for a farm (so we
// reuse it instead of re-registering) and the last real monitoring payload
// (so a reload shows the last real numbers instead of refetching constantly).
// ---------------------------------------------------------------------------

export function cacheAgroPolyId(farmKey: string, polyId: string): void {
  safeSet(`${AGRO_KEY}poly:${farmKey}`, polyId);
}

export function readCachedAgroPolyId(farmKey: string): string | null {
  const raw = safeGet(`${AGRO_KEY}poly:${farmKey}`);
  if (!raw) return null;
  return /^[A-Za-z0-9]{8,40}$/.test(raw) ? raw : null;
}

/** Cache a real AgroMonitoring payload with a freshness TTL. */
export function cacheAgroMonitoring(
  farmKey: string,
  data: AgroMonitoringData
): void {
  safeSet(`${AGRO_KEY}data:${farmKey}`, JSON.stringify(data));
}

export function readCachedAgroMonitoring(
  farmKey: string
): AgroMonitoringData | null {
  const raw = safeGet(`${AGRO_KEY}data:${farmKey}`);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as AgroMonitoringData;
    if (!data || typeof data.ok !== "boolean") return null;
    if (Date.now() - data.fetchedAt > AGRO_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}
