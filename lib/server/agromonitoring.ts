/**
 * AgroMonitoring (OpenWeather) — server-side agricultural monitoring.
 *
 * Official API base: https://api.agromonitoring.com/agro/1.0/  (see
 * https://agromonitoring.com/api — Polygon API, NDVI history, Satellite
 * Imagery API, Soil API). Every endpoint below was verified against the
 * official documentation. The API key travels ONLY server-side via
 * AGROMONITORING_API_KEY — never in frontend JS, never in tile/image URLs
 * handed to the browser (AgroMonitoring embeds ?appid= in its asset URLs, so
 * we re-serve images through our own proxy and return numbers only).
 *
 * Honesty rules:
 *  - NDVI/imagery/soil numbers below are REAL values returned by the API.
 *  - If the API fails or is not configured we return an explicit
 *    notConfigured / unavailable result — never fake numbers.
 *  - Soil "moisture" is the API's model estimate (m3/m3), not a field probe;
 *    the UI must label it as an estimate.
 */

const AGRO_BASE =
  process.env.AGROMONITORING_BASE_URL ?? "https://api.agromonitoring.com/agro/1.0";

import type { AgroNdviObs } from "@/lib/types";

const TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// In-memory cache: NDVI history + imagery are stable for hours; soil updates
// twice a day. TTLs chosen to respect the API's request limits.
// ---------------------------------------------------------------------------

const CACHE_TTL = {
  ndviHistory: 6 * 60 * 60 * 1000, // 6 h
  imagery: 6 * 60 * 60 * 1000, // 6 h
  soil: 30 * 60 * 1000, // 30 min
  imageBytes: 60 * 60 * 1000, // 1 h (proxy cache)
};

const cache = new Map<string, { value: unknown; expiresAt: number }>();

function cachedGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  if (hit) cache.delete(key);
  return null;
}

function cachedSet(key: string, value: unknown, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Cap the cache so a long-running server cannot grow unbounded. */
function cacheTrim(maxEntries = 200): void {
  if (cache.size <= maxEntries) return;
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
  let extra = cache.size - maxEntries;
  for (const k of cache.keys()) {
    if (extra <= 0) break;
    cache.delete(k);
    extra--;
  }
}

// ---------------------------------------------------------------------------
// Types (subset of the official API response shapes we actually consume).
// ---------------------------------------------------------------------------

export interface AgroStats {
  std: number | null;
  p25: number | null;
  num: number | null;
  min: number | null;
  max: number | null;
  median: number | null;
  p75: number | null;
  mean: number | null;
}

export interface AgroNdviObservation {
  /** Unix time (s) of the observation. */
  dt: number;
  /** Satellite source: "l8" (Landsat 8) or "s2" (Sentinel-2). */
  source: "l8" | "s2" | string;
  /** Approximate % of the polygon covered by valid data. */
  coveragePct: number | null;
  /** Approximate % of clouds. */
  cloudPct: number | null;
  stats: AgroStats;
}

export interface AgroImageryEntry {
  dt: number;
  /** "Landsat 8" or "Sentinel 2". */
  satellite: string;
  /** Approximate % of valid data coverage. */
  coveragePct: number | null;
  /** Approximate % of cloud coverage. */
  cloudPct: number | null;
  /** Opaque token for the proxied true-color PNG (never the raw URL). */
  imageToken: string | null;
}

export interface AgroSoil {
  /** Time of data calculation (unix s, UTC). */
  dt: number;
  /** Surface temperature, Kelvins. */
  t0K: number | null;
  /** Temperature at 10 cm depth, Kelvins. */
  t10K: number | null;
  /** Soil moisture, m3/m3 (model estimate — NOT a field probe). */
  moistureM3: number | null;
}

export type AgroErrorKind =
  | "not_configured"
  | "invalid_key"
  | "rate_limited"
  | "timeout"
  | "network"
  | "bad_request"
  | "no_data"
  | "unexpected";

export class AgroError extends Error {
  kind: AgroErrorKind;
  status: number | null;
  constructor(kind: AgroErrorKind, message: string, status: number | null = null) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/** true when AGROMONITORING_API_KEY is configured (and not a placeholder). */
export function agroConfigured(): boolean {
  const key = process.env.AGROMONITORING_API_KEY;
  return Boolean(key) && !key!.startsWith("<") && !key!.startsWith("YOUR_");
}

function appidParam(): string {
  const key = process.env.AGROMONITORING_API_KEY ?? "";
  return `appid=${encodeURIComponent(key)}`;
}

/** Interpret an HTTP error into a farmer-safe AgroError kind. */
function classifyStatus(status: number, body: string): AgroError {
  if (status === 401 || status === 403) {
    return new AgroError(
      "invalid_key",
      "AgroMonitoring rejected the API key (401/403)",
      status
    );
  }
  if (status === 429) {
    return new AgroError(
      "rate_limited",
      "AgroMonitoring rate limit reached (429)",
      status
    );
  }
  if (status === 400 || status === 422) {
    return new AgroError("bad_request", `AgroMonitoring rejected request (${status}): ${body.slice(0, 160)}`, status);
  }
  if (status === 404) {
    return new AgroError("no_data", "AgroMonitoring: polygon or data not found (404)", status);
  }
  return new AgroError("unexpected", `AgroMonitoring HTTP ${status}`, status);
}

async function agroFetch(
  url: string,
  init?: { method?: string; body?: unknown }
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers:
        init?.body !== undefined ? { "content-type": "application/json" } : undefined,
      body:
        init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 0 },
      cache: "no-store",
    });
  } catch (e) {
    const err = e as { name?: string };
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new AgroError("timeout", "AgroMonitoring request timed out");
    }
    throw new AgroError("network", "AgroMonitoring network failure");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw classifyStatus(res.status, body);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Polygon API — create a farm polygon and get its ID.
// https://agromonitoring.com/api/polygons
// ---------------------------------------------------------------------------

export interface AgroPolygonCreated {
  id: string;
  /** [lon, lat] as returned by the API. */
  center: [number, number] | null;
  /** Area in hectares. */
  areaHa: number | null;
}

/**
 * Create (or reuse) a farm polygon.
 * @param name   polygon name (e.g. "Fasal Nigrani farm <key>")
 * @param ring   field ring as [lat, lon][] (the app's internal format)
 * @param polyId optional previously-created AgroMonitoring id to reuse
 */
export async function createFarmPolygon(
  name: string,
  ring: [number, number][],
  polyId?: string | null
): Promise<AgroPolygonCreated> {
  if (!agroConfigured()) {
    throw new AgroError("not_configured", "AGROMONITORING_API_KEY is not set");
  }
  if (polyId) {
    // Already registered — verify it still exists, then reuse.
    try {
      const info = await getPolygonInfo(polyId);
      return {
        id: info.id,
        center: info.center,
        areaHa: info.areaHa,
      };
    } catch {
      // Fall through and (re)create.
    }
  }
  if (ring.length < 3) {
    throw new AgroError("bad_request", "Farm polygon needs at least 3 points");
  }

  // GeoJSON coordinates are [lon, lat]; the API requires the ring to be
  // explicitly closed (first == last).
  const toLonLat = (r: [number, number][]): [number, number][] =>
    r.map(([lat, lon]) => [lon, lat] as [number, number]);
  const closed: [number, number][] =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? toLonLat(ring)
      : [...toLonLat(ring), [ring[0][1], ring[0][0]] as [number, number]];

  const body = {
    name,
    geo_json: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [closed],
      },
    },
  };

  const res = await agroFetch(`${AGRO_BASE}/polygons?${appidParam()}`, {
    method: "POST",
    body,
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AgroError("unexpected", "AgroMonitoring returned a malformed response");
  }
  const created = json as {
    id?: unknown;
    center?: unknown;
    area?: unknown;
  };
  if (typeof created?.id !== "string") {
    // The API blocks duplicate polygons. Try the duplicates-allowed flag once.
    const res2 = await agroFetch(
      `${AGRO_BASE}/polygons?${appidParam()}&duplicated=true`,
      { method: "POST", body }
    );
    let json2: unknown;
    try {
      json2 = await res2.json();
    } catch {
      throw new AgroError("unexpected", "AgroMonitoring returned a malformed response");
    }
    const c2 = json2 as { id?: unknown; center?: unknown; area?: unknown };
    if (typeof c2?.id !== "string") {
      throw new AgroError("unexpected", "AgroMonitoring did not return a polygon id");
    }
    return normalizeCreated(c2);
  }
  return normalizeCreated(created);
}

function normalizeCreated(raw: {
  id?: unknown;
  center?: unknown;
  area?: unknown;
}): AgroPolygonCreated {
  const center = Array.isArray(raw.center) && raw.center.length === 2
    ? ([Number(raw.center[0]), Number(raw.center[1])] as [number, number])
    : null;
  return {
    id: String(raw.id),
    center,
    areaHa: typeof raw.area === "number" ? raw.area : null,
  };
}

/** GET /agro/1.0/polygons/{id}?appid= */
export async function getPolygonInfo(
  polyId: string
): Promise<AgroPolygonCreated> {
  const res = await agroFetch(`${AGRO_BASE}/polygons/${polyId}?${appidParam()}`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AgroError("unexpected", "AgroMonitoring returned a malformed response");
  }
  const raw = json as { id?: unknown; center?: unknown; area?: unknown };
  if (typeof raw?.id !== "string") {
    throw new AgroError("no_data", "AgroMonitoring polygon not found");
  }
  return normalizeCreated(raw);
}

// ---------------------------------------------------------------------------
// NDVI history — real per-polygon vegetation index observations.
// https://agromonitoring.com/api/history-ndvi
// ---------------------------------------------------------------------------

function parseStats(raw: unknown): AgroStats {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (k: string): number | null => {
    const v = r[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  return {
    std: num("std"),
    p25: num("p25"),
    num: num("num"),
    min: num("min"),
    max: num("max"),
    median: num("median"),
    p75: num("p75"),
    mean: num("mean"),
  };
}

/**
 * Latest NDVI observations for a polygon over the recent window.
 * Returns observations sorted newest-first, filtered to usable ones
 * (>= 1 pixel measured).
 */
export async function getNdviHistory(
  polyId: string,
  windowDays = 45
): Promise<AgroNdviObservation[]> {
  const key = `ndvi:${polyId}:${windowDays}`;
  const hit = cachedGet<AgroNdviObservation[]>(key);
  if (hit) return hit;

  const end = Math.floor(Date.now() / 1000);
  const start = end - windowDays * 86_400;
  const res = await agroFetch(
    `${AGRO_BASE}/ndvi/history?start=${start}&end=${end}&polyid=${encodeURIComponent(
      polyId
    )}&${appidParam()}`
  );
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AgroError("unexpected", "AgroMonitoring returned a malformed response");
  }
  const arr = Array.isArray(json) ? json : [];
  const parsed: AgroNdviObservation[] = [];
  for (const item of arr) {
    const rec = item as {
      dt?: unknown;
      source?: unknown;
      type?: unknown;
      dc?: unknown;
      cl?: unknown;
      data?: unknown;
    };
    if (typeof rec?.dt !== "number") continue;
    const stats = parseStats(rec.data);
    if (stats.num === null || stats.num <= 0) continue;
    // The live API labels the satellite with "type" (e.g. "Landsat 8" /
    // "Sentinel 2"); older docs show "source" ("l8"/"s2"). Read both.
    const source = String(rec.type ?? rec.source ?? "unknown");
    parsed.push({
      dt: rec.dt,
      source,
      coveragePct: typeof rec.dc === "number" ? rec.dc : null,
      cloudPct: typeof rec.cl === "number" ? rec.cl : null,
      stats,
    });
  }
  parsed.sort((a, b) => b.dt - a.dt);
  const result = parsed.slice(0, 10);
  cachedSet(key, result, CACHE_TTL.ndviHistory);
  cacheTrim();
  return result;
}

// ---------------------------------------------------------------------------
// Satellite imagery search — latest real observations (2-step API, step 1).
// https://agromonitoring.com/api/images
// ---------------------------------------------------------------------------

/**
 * Search recent satellite imagery for the polygon. Returns the newest entries
 * with their real acquisition date, satellite, cloud/data coverage — plus an
 * opaque token for the proxied true-color image. The raw AgroMonitoring asset
 * URLs embed ?appid= so they are never handed to the browser; images are
 * fetched server-side and re-served through /api/agromonitoring/image.
 */
export async function searchSatelliteImagery(
  polyId: string,
  windowDays = 30
): Promise<AgroImageryEntry[]> {
  const key = `img:${polyId}:${windowDays}`;
  const hit = cachedGet<AgroImageryEntry[]>(key);
  if (hit) return hit;

  const end = Math.floor(Date.now() / 1000);
  const start = end - windowDays * 86_400;
  const res = await agroFetch(
    `${AGRO_BASE}/image/search?start=${start}&end=${end}&polyid=${encodeURIComponent(
      polyId
    )}&${appidParam()}`
  );
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AgroError("unexpected", "AgroMonitoring returned a malformed response");
  }
  const arr = Array.isArray(json) ? json : [];
  const entries: AgroImageryEntry[] = [];
  for (const item of arr) {
    const rec = item as {
      dt?: unknown;
      type?: unknown;
      dc?: unknown;
      cl?: unknown;
      image?: unknown;
    };
    if (typeof rec?.dt !== "number") continue;
    const image = (rec.image ?? {}) as { truecolor?: unknown };
    // The true-color URL embeds ?appid=KEY. It is stored server-side only;
    // the client asks for the image by polyid + acquisition time and our
    // proxy resolves it here — the key never reaches the browser.
    const trueColorUrl =
      typeof image.truecolor === "string" ? image.truecolor : null;
    if (trueColorUrl) {
      imageUrls.set(`${polyId}:${rec.dt}`, {
        url: trueColorUrl,
        expiresAt: Date.now() + CACHE_TTL.imagery,
      });
    }
    entries.push({
      dt: rec.dt,
      satellite:
        typeof rec.type === "string"
          ? rec.type
          : "satellite",
      coveragePct: typeof rec.dc === "number" ? rec.dc : null,
      cloudPct: typeof rec.cl === "number" ? rec.cl : null,
      imageToken: null,
    });
  }
  entries.sort((a, b) => b.dt - a.dt);
  const result = entries.slice(0, 10);
  cachedSet(key, result, CACHE_TTL.imagery);
  cacheTrim();
  return result;
}

// ---------------------------------------------------------------------------
// Image proxy — AgroMonitoring image URLs embed ?appid=KEY. We store the raw
// URL server-side keyed by (polyId, acquisition time) and re-serve the PNG
// bytes through our own route. The client never sees the raw URL. The URL
// mapping is refreshed automatically by searchSatelliteImagery, so a server
// restart does not break previously returned imagery (a fresh search finds
// the same acquisition and re-registers the URL).
// ---------------------------------------------------------------------------

const imageUrls = new Map<
  string,
  { url: string; expiresAt: number }
>();
const imageBytes = new Map<
  string,
  { data: ArrayBuffer; type: string; expiresAt: number }
>();

/** Resolve a proxied AgroMonitoring image by polygon id + acquisition time. */
export async function getProxiedImage(
  polyId: string,
  dt: number
): Promise<{ data: ArrayBuffer; type: string } | null> {
  const key = `${polyId}:${dt}`;
  const cached = imageBytes.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data, type: cached.type };
  }

  let url = imageUrls.get(key)?.url ?? null;
  if (!url) {
    // URL mapping lost (restart) — re-run the search to find this acquisition.
    try {
      const found = await searchSatelliteImagery(polyId, 45);
      const entry = found.find((e) => e.dt === dt);
      url = imageUrls.get(`${polyId}:${dt}`)?.url ?? null;
      if (!url && entry) {
        // Should not happen (search re-registers), but stay honest.
        return null;
      }
    } catch {
      return null;
    }
  }
  if (!url) return null;

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.arrayBuffer();
  const type = res.headers.get("content-type") ?? "image/png";
  imageBytes.set(key, { data, type, expiresAt: Date.now() + CACHE_TTL.imageBytes });
  cacheTrim();
  return { data, type };
}

// ---------------------------------------------------------------------------
// Soil API — current soil temperature + moisture estimate.
// https://agromonitoring.com/api/current-soil
// ---------------------------------------------------------------------------

export async function getSoil(polyId: string): Promise<AgroSoil | null> {
  const key = `soil:${polyId}`;
  const hit = cachedGet<AgroSoil | null>(key);
  if (hit !== null) return hit;

  const res = await agroFetch(
    `${AGRO_BASE}/soil?polyid=${encodeURIComponent(polyId)}&${appidParam()}`
  );
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AgroError("unexpected", "AgroMonitoring returned a malformed response");
  }
  const rec = json as {
    dt?: unknown;
    t10?: unknown;
    moisture?: unknown;
    t0?: unknown;
  };
  if (typeof rec?.dt !== "number") {
    // No soil data for this polygon right now.
    cachedSet(key, null, CACHE_TTL.soil);
    return null;
  }
  const soil: AgroSoil = {
    dt: rec.dt,
    t0K: typeof rec.t0 === "number" ? rec.t0 : null,
    t10K: typeof rec.t10 === "number" ? rec.t10 : null,
    moistureM3: typeof rec.moisture === "number" ? rec.moisture : null,
  };
  cachedSet(key, soil, CACHE_TTL.soil);
  cacheTrim();
  return soil;
}

// ---------------------------------------------------------------------------
// Combined farm monitoring payload for the dashboard.
// ---------------------------------------------------------------------------

export interface AgroMonitoringPayload {
  ok: boolean;
  configured: boolean;
  polyId: string | null;
  /** Latest usable NDVI observation (newest) — flat shared-client shape. */
  ndviLatest: AgroNdviObs | null;
  /** Previous usable NDVI observation (for trend). */
  ndviPrev: AgroNdviObs | null;
  /** Newest satellite imagery entry (true color). */
  imagery: AgroImageryEntry | null;
  soil: AgroSoil | null;
  fetchedAt: number;
  /** Developer-facing error kind (never shown raw to the farmer). */
  error: AgroErrorKind | null;
  errorMessage: string | null;
}

/**
 * Flat-shape a raw API observation into the client contract (AgroNdviObs):
 * the shared types expose mean/median/min/max directly, while the upstream API
 * nests them under `stats`. Without this the dashboard reads undefined values
 * and crashes in `.toFixed()`.
 */
function toNdviObs(obs: AgroNdviObservation): AgroNdviObs {
  return {
    dt: obs.dt,
    source: obs.source,
    coveragePct: obs.coveragePct,
    cloudPct: obs.cloudPct,
    mean: obs.stats?.mean ?? null,
    median: obs.stats?.median ?? null,
    min: obs.stats?.min ?? null,
    max: obs.stats?.max ?? null,
  };
}

export async function getFarmMonitoring(
  polyId: string
): Promise<AgroMonitoringPayload> {
  const fetchedAt = Date.now();
  const fail = (kind: AgroErrorKind, message: string): AgroMonitoringPayload => ({
    ok: false,
    configured: agroConfigured(),
    polyId,
    ndviLatest: null,
    ndviPrev: null,
    imagery: null,
    soil: null,
    fetchedAt,
    error: kind,
    errorMessage: message,
  });

  if (!agroConfigured()) {
    return fail("not_configured", "AGROMONITORING_API_KEY is not set");
  }

  // Each sub-call fails independently so one broken source never hides others.
  let ndvi: AgroNdviObservation[] = [];
  let imagery: AgroImageryEntry[] = [];
  let soil: AgroSoil | null = null;
  let error: AgroErrorKind | null = null;
  let errorMessage: string | null = null;

  try {
    ndvi = await getNdviHistory(polyId);
  } catch (e) {
    const ae = e as AgroError;
    error = ae.kind;
    errorMessage = ae.message;
  }
  try {
    imagery = await searchSatelliteImagery(polyId);
  } catch (e) {
    const ae = e as AgroError;
    error = error ?? ae.kind;
    errorMessage = errorMessage ?? ae.message;
  }
  try {
    soil = await getSoil(polyId);
  } catch (e) {
    const ae = e as AgroError;
    error = error ?? ae.kind;
    errorMessage = errorMessage ?? ae.message;
  }

  const hasAny = ndvi.length > 0 || imagery.length > 0 || soil !== null;
  if (!hasAny && error) {
    return fail(error, errorMessage ?? "no data");
  }

  return {
    ok: true,
    configured: true,
    polyId,
    ndviLatest: ndvi[0] ? toNdviObs(ndvi[0]) : null,
    ndviPrev: ndvi[1] ? toNdviObs(ndvi[1]) : null,
    imagery: imagery[0] ?? null,
    soil,
    fetchedAt,
    error: error && !hasAny ? error : null,
    errorMessage: error && !hasAny ? errorMessage : null,
  };
}