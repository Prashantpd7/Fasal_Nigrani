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
import type { WeatherPayload } from "./types";

const WEATHER_PREFIX = "fn-weather-";
const META_KEY = "fn-meta";
const STALE_MS = 1000 * 60 * 60 * 4; // 4h-old snapshot is still useful

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
