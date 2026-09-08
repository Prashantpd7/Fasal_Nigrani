/**
 * Farm geometry helpers (§ Farm — field selection). Pure functions, SSR-safe.
 */

export interface LatLng {
  lat: number;
  lon: number;
}

/** Approximate metres per degree latitude. */
const M_PER_DEG_LAT = 111_320;

function mercatorMetersPerLon(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return M_PER_DEG_LAT * Math.cos(rad);
}

/**
 * Approximate polygon area in m² using the shoelace formula on a local
 * equirectangular plane. Accurate to a few percent for fields (<< 100 km).
 */
export function polygonAreaM2(ring: [number, number][]): number | null {
  if (ring.length < 3) return null;
  const lat0 = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const kx = mercatorMetersPerLon(lat0);
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [latA, lonA] = ring[i];
    const [latB, lonB] = ring[(i + 1) % ring.length];
    const xA = lonA * kx;
    const yA = latA * M_PER_DEG_LAT;
    const xB = lonB * kx;
    const yB = latB * M_PER_DEG_LAT;
    sum += xA * yB - xB * yA;
  }
  return Math.abs(sum) / 2;
}

export function m2ToHectares(m2: number): number {
  return m2 / 10_000;
}

export function m2ToAcres(m2: number): number {
  return m2 / 4046.86;
}

/** Ray-casting point-in-polygon test on [lat, lon] ring. */
export function pointInRing(
  lat: number,
  lon: number,
  ring: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lonI] = ring[i];
    const [latJ, lonJ] = ring[j];
    const intersect =
      lonI > lon !== lonJ > lon &&
      lat < ((latJ - latI) * (lon - lonI)) / (lonJ - lonI) + latI;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface BBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export function ringBBox(ring: [number, number][]): BBox | null {
  if (ring.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return { minLat, minLon, maxLat, maxLon };
}

/**
 * Web-Mercator tile coordinates (standard XYZ scheme used by Leaflet and
 * GIBS GoogleMapsCompatible tiles).
 */
export function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 -
      Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) /
      2) *
      Math.pow(2, z)
  );
}

/** Pixel coordinates (in tile space, 0..256) of a lat/lon at a zoom level. */
export function latLonToPixel(
  lat: number,
  lon: number,
  z: number
): { x: number; y: number } {
  const n = Math.pow(2, z);
  const x = ((lon + 180) / 360) * n * 256;
  const rad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    n *
    256;
  return { x, y };
}

/** All tiles at zoom z that intersect a bbox (cap to avoid runaway fetches). */
export function tilesForBBox(
  bbox: BBox,
  z: number,
  cap = 12
): { x: number; y: number }[] {
  const n = Math.pow(2, z);
  const clampX = (x: number) => Math.min(n - 1, Math.max(0, x));
  const clampY = (y: number) => Math.min(n - 1, Math.max(0, y));
  const x0 = clampX(lonToTileX(bbox.minLon, z));
  const x1 = clampX(lonToTileX(bbox.maxLon, z));
  const y0 = clampY(latToTileY(bbox.maxLat, z));
  const y1 = clampY(latToTileY(bbox.minLat, z));
  const out: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (out.length >= cap) return out;
      out.push({ x, y });
    }
  }
  return out;
}