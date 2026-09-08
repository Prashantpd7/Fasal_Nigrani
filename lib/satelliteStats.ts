"use client";

import type { SatelliteStats, SatelliteStatus } from "./types";
import { pointInRing, ringBBox, tilesForBBox } from "./farmGeometry";

/**
 * Client-side satellite measurement (§ Farm — satellite monitoring).
 *
 * The browser downloads the actual NASA GIBS tiles (CORS is open, no key),
 * decodes each pixel back to an NDVI / cloud-fraction value using the exact
 * official GIBS colormaps, and averages only the pixels INSIDE the farm
 * polygon. This is a real measurement of real satellite data — never a
 * guessed number. If any step fails, the result is honestly "unavailable".
 */

const TILE_SIZE = 256;

/** Parse a GIBS v1.3 colormap XML into rgb-key -> value midpoints. */
export async function fetchColormap(url: string): Promise<Map<string, number>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("colormap HTTP " + res.status);
  const xml = await res.text();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const map = new Map<string, number>();
  const entries = Array.from(doc.getElementsByTagName("ColorMapEntry"));
  for (const e of entries) {
    const transparent = e.getAttribute("transparent") === "true";
    if (transparent) continue; // no-data / below-range pixels
    const rgb = e.getAttribute("rgb");
    const raw = e.getAttribute("value");
    if (!rgb || !raw) continue;
    const value = parseValue(raw);
    if (value === null) continue;
    const key = rgb
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .join(",");
    if (!map.has(key)) map.set(key, value);
  }
  if (map.size === 0) throw new Error("colormap empty");
  return map;
}

/** "[a,b)" interval or a scalar -> midpoint value. */
function parseValue(raw: string): number | null {
  const m = raw.match(/^\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);
  if (m) return (parseFloat(m[1]) + parseFloat(m[2])) / 2;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

async function loadTilePixels(
  url: string,
  signal?: AbortSignal
): Promise<Uint8ClampedArray | null> {
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, TILE_SIZE, TILE_SIZE);
    return ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
  } finally {
    bitmap.close();
  }
}

interface Measured {
  sum: number;
  count: number;
}

/** Average a colormapped GIBS layer over the pixels inside the farm ring. */
async function measureLayer(
  status: SatelliteStatus,
  layer: NonNullable<SatelliteStatus["ndvi"]>,
  date: string,
  ring: [number, number][],
  colormap: Map<string, number>,
  signal?: AbortSignal
): Promise<Measured | null> {
  const bbox = ringBBox(ring);
  if (!bbox) return null;
  const z = Math.max(layer.minZoom, Math.min(layer.maxZoom, 8));
  const tiles = tilesForBBox(bbox, z, 12);
  let sum = 0;
  let count = 0;
  for (const t of tiles) {
    const url = layer.tileUrl
      .replace("{date}", date)
      .replace("{z}", String(z))
      .replace("{y}", String(t.y))
      .replace("{x}", String(t.x));
    const data = await loadTilePixels(url, signal);
    if (!data) continue;
    for (let py = 0; py < TILE_SIZE; py++) {
      const gy = t.y * TILE_SIZE + py;
      for (let px = 0; px < TILE_SIZE; px++) {
        const alpha = data[(py * TILE_SIZE + px) * 4 + 3];
        if (alpha < 128) continue; // transparent = no data
        const gx = t.x * TILE_SIZE + px;
        const { lat, lon } = pixelToLatLon(gx, gy, z);
        if (
          lat < bbox.minLat - 0.001 ||
          lat > bbox.maxLat + 0.001 ||
          lon < bbox.minLon - 0.001 ||
          lon > bbox.maxLon + 0.001
        ) {
          continue;
        }
        if (!pointInRing(lat, lon, ring)) continue;
        const i = (py * TILE_SIZE + px) * 4;
        const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        const value = colormap.get(key) ?? nearestValue(colormap, data[i], data[i + 1], data[i + 2]);
        if (value === null) continue;
        sum += value;
        count++;
      }
    }
  }
  if (count === 0) return null;
  return { sum, count };
}

/** Fallback: nearest colormap entry (tolerance ~4 per channel). */
function nearestValue(
  colormap: Map<string, number>,
  r: number,
  g: number,
  b: number
): number | null {
  let best: number | null = null;
  let bestDist = 25;
  for (const [key, value] of colormap) {
    const [kr, kg, kb] = key.split(",").map((s) => parseInt(s, 10));
    const dist = (kr - r) ** 2 + (kg - g) ** 2 + (kb - b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = value;
    }
  }
  return best;
}

function pixelToLatLon(
  gx: number,
  gy: number,
  z: number
): { lat: number; lon: number } {
  const n = Math.pow(2, z);
  const lon = (gx / (n * TILE_SIZE)) * 360 - 180;
  const yNorm = gy / (n * TILE_SIZE);
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * yNorm)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lon };
}

/**
 * Measure the farm polygon with the real satellite layers. Returns an honest
 * result: null means "could not measure" (network / no data), never a guess.
 */
export async function computeSatelliteStats(
  status: SatelliteStatus,
  ring: [number, number][],
  signal?: AbortSignal
): Promise<SatelliteStats> {
  const empty: SatelliteStats = {
    ndviMean: null,
    ndviPrevMean: null,
    ndviDelta: null,
    validPixels: 0,
    cloudPct: null,
    obsDate: status.ndvi?.date ?? null,
    prevObsDate: status.ndvi?.prevDate ?? null,
    unavailable: true,
    error: null,
  };
  if (!status.ok || !status.ndvi || ring.length < 3) {
    return { ...empty, error: "no-layer" };
  }

  try {
    const [ndviColormap, cloudColormap] = await Promise.all([
      fetchColormap(status.ndvi.colormapUrl),
      status.cloud
        ? fetchColormap(status.cloud.colormapUrl).catch(() => null)
        : Promise.resolve(null),
    ]);

    const current = await measureLayer(
      status,
      status.ndvi,
      status.ndvi.date,
      ring,
      ndviColormap,
      signal
    );
    let previous: Measured | null = null;
    if (status.ndvi.prevDate) {
      previous = await measureLayer(
        status,
        status.ndvi,
        status.ndvi.prevDate,
        ring,
        ndviColormap,
        signal
      );
    }

    let cloudPct: number | null = null;
    if (status.cloud && cloudColormap) {
      const cloud = await measureLayer(
        status,
        status.cloud,
        status.cloud.date,
        ring,
        cloudColormap,
        signal
      );
      if (cloud) cloudPct = Math.round(cloud.sum / cloud.count);
    }

    const ndviMean =
      current && current.count >= 5 ? current.sum / current.count : null;
    const ndviPrevMean =
      previous && previous.count >= 5 ? previous.sum / previous.count : null;
    const ndviDelta =
      ndviMean !== null && ndviPrevMean !== null
        ? Math.round((ndviMean - ndviPrevMean) * 1000) / 1000
        : null;

    return {
      ndviMean,
      ndviPrevMean,
      ndviDelta,
      validPixels: current?.count ?? 0,
      cloudPct,
      obsDate: status.ndvi.date,
      prevObsDate: status.ndvi.prevDate,
      unavailable: ndviMean === null,
      error: ndviMean === null ? "no-data" : null,
    };
  } catch (e) {
    return {
      ...empty,
      error: e instanceof Error ? e.message : "network",
    };
  }
}