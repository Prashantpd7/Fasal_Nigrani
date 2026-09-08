import type { SatelliteLayer, SatelliteStatus } from "@/lib/types";

/**
 * Satellite service (§ Farm — satellite).
 *
 * Real, free, keyless sources only:
 *  - Basemap satellite imagery  -> Esri World Imagery (XYZ tiles, free, no key)
 *  - Vegetation index (NDVI)    -> NASA GIBS VIIRS/MODIS NDVI WMTS (free, no key)
 *  - Cloud cover                -> NASA GIBS MODIS Cloud Fraction (free, no key)
 *
 * ISRO/MOSDAC and Copernicus Sentinel-2 are NOT used by default: MOSDAC needs
 * a registered ISRO account with no practical public WMTS for NDVI, and
 * Copernicus Data Space needs OAuth client credentials + a configured OGC
 * instance. They are reported honestly as "not connected" so the UI never
 * pretends higher-resolution imagery exists when it does not.
 *
 * GIBS details (verified against the live service):
 *   WMTS REST: /wmts/epsg3857/best/{Layer}/default/{Time}/{TMS}/{z}/{y}/{x}.png
 *   The <Default> date in the capabilities is the latest available composite.
 *   DescribeDomains returns every available date for a layer.
 *   GIBS sends Access-Control-Allow-Origin: * so browsers can read tiles.
 */

const GIBS_BASE =
  process.env.SATELLITE_API_URL ?? "https://gibs.earthdata.nasa.gov";

const CAPABILITIES_URL = `${GIBS_BASE}/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml`;

const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

interface ProductSpec {
  /** WMTS layer identifier in GIBS. */
  layer: string;
  /** TileMatrixSet used by this layer. */
  tms: string;
  /** GIBS colormap file (v1.3) used to decode pixel colours. */
  colormap: string;
  /** Title shown to the farmer. */
  title: string;
  /** Composite length in days (for the honest "observation date" line). */
  periodDays: number;
  zoomRange: { min: number; max: number };
}

const NDVI_PRIMARY: ProductSpec = {
  layer: "VIIRS_SNPP_NDVI_8Day",
  tms: "GoogleMapsCompatible_Level8",
  colormap: "MODIS_NDVI.xml",
  title: "Vegetation index (NDVI)",
  periodDays: 8,
  zoomRange: { min: 0, max: 8 },
};

const NDVI_FALLBACK: ProductSpec = {
  layer: "MODIS_Terra_L3_NDVI_16Day",
  tms: "GoogleMapsCompatible_Level9",
  colormap: "MODIS_L3_NDVI.xml",
  title: "Vegetation index (NDVI)",
  periodDays: 16,
  zoomRange: { min: 0, max: 9 },
};

const CLOUD_SPEC: ProductSpec = {
  layer: "MODIS_Terra_Cloud_Fraction_Day",
  tms: "GoogleMapsCompatible_Level6",
  colormap: "MODIS_Cloud_Fraction.xml",
  title: "Cloud cover",
  periodDays: 1,
  zoomRange: { min: 0, max: 6 },
};

// ---------------------------------------------------------------------------
// Cached capabilities (GIBS is a public static-ish feed; 6h TTL is plenty).
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<
  string,
  { value: string; expiresAt: number }
>();

async function fetchCached(
  key: string,
  url: string,
  minLength = 1000
): Promise<string> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`satellite HTTP ${res.status}`);
  const text = await res.text();
  if (!text || text.length < minLength) throw new Error("satellite empty response");
  cache.set(key, { value: text, expiresAt: Date.now() + CACHE_TTL_MS });
  return text;
}

/** Pull a <ows:Identifier>..</ows:Identifier> block value out of a layer. */
function layerBlock(xml: string, layerId: string): string {
  const start = xml.indexOf(`<ows:Identifier>${layerId}</ows:Identifier>`);
  if (start === -1) throw new Error(`layer ${layerId} not in capabilities`);
  const seg = xml.slice(Math.max(0, start - 4000), start + 8000);
  return seg;
}

function extractDefaultDate(seg: string): string | null {
  const m = seg.match(/<Default>(\d{4}-\d{2}-\d{2})<\/Default>/);
  return m ? m[1] : null;
}

/** Add/subtract days to an ISO date (yyyy-mm-dd). */
function isoAddDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Expand a GIBS DescribeDomains <Domain> list ("r1/p1D,r2/p2D…") to dates. */
function expandDomain(domain: string, limit: number): string[] {
  const out: string[] = [];
  for (const range of domain.split(",")) {
    if (out.length >= limit) break;
    const m = range.match(
      /^(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})\/(P\d+D)$/
    );
    if (!m) continue;
    const [, startRaw, endRaw, stepRaw] = m;
    const start = new Date(`${startRaw}T00:00:00Z`);
    const end = new Date(`${endRaw}T00:00:00Z`);
    const stepDays = parseInt(stepRaw.replace("P", "").replace("D", ""), 10) || 1;
    for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + stepDays)) {
      if (out.length >= limit) break;
      out.push(d.toISOString().slice(0, 10));
    }
  }
  return out;
}

/** Latest available dates for a layer via DescribeDomains (recent window). */
async function recentDates(spec: ProductSpec): Promise<string[]> {
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 120);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 1);
  const url = `${GIBS_BASE}/wmts/epsg3857/best/1.0.0/${spec.layer}/default/${spec.tms}/all/${start
    .toISOString()
    .slice(0, 10)}--${end.toISOString().slice(0, 10)}.xml`;
  const xml = await fetchCached(`dd:${spec.layer}`, url, 50);
  const m = xml.match(/<DimensionDomain>[\s\S]*?<Domain>([\s\S]*?)<\/Domain>/);
  if (!m) return [];
  // Expand generously (window is <= 122 days at P1D; cap at 2000 is safe) and
  // return dates inside the requested window only.
  const all = expandDomain(m[1], 2000);
  const todayStr = today.toISOString().slice(0, 10);
  const startStr = start.toISOString().slice(0, 10);
  return all
    .filter((d) => d >= startStr && d <= todayStr)
    .sort();
}

/** Build a SatelliteLayer for a product with the given dates. */
function buildLayer(
  spec: ProductSpec,
  date: string,
  prevDate: string | null
): SatelliteLayer {
  const daysAgo = Math.max(
    0,
    Math.round(
      (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000
    )
  );
  return {
    source: "nasa-gibs",
    product: spec.layer,
    date,
    prevDate,
    periodDays: spec.periodDays,
    daysAgo,
    tileUrl: `${GIBS_BASE}/wmts/epsg3857/best/${spec.layer}/default/{date}/${spec.tms}/{z}/{y}/{x}.png`,
    colormapUrl: `${GIBS_BASE}/colormaps/v1.3/${spec.colormap}`,
    maxZoom: spec.zoomRange.max,
    minZoom: spec.zoomRange.min,
    title: spec.title,
  };
}

/**
 * Current satellite status. Throws when GIBS is unreachable so the route can
 * return a clearly-labelled "not available" response — never fake data.
 */
export async function getSatelliteStatus(): Promise<SatelliteStatus> {
  const caps = await fetchCached("caps", CAPABILITIES_URL);

  // NDVI: prefer the freshest product (VIIRS 8-day). Fall back to MODIS 16-day
  // when VIIRS is missing from the capabilities.
  let ndviSpec = NDVI_PRIMARY;
  if (!caps.includes(`<ows:Identifier>${NDVI_PRIMARY.layer}</ows:Identifier>`)) {
    ndviSpec = NDVI_FALLBACK;
  }
  const ndviSeg = layerBlock(caps, ndviSpec.layer);
  const ndviDate = extractDefaultDate(ndviSeg);
  if (!ndviDate) {
    throw new Error("no NDVI observation date available");
  }
  // Previous observation = the previous composite period of the same product
  // (8-day NDVI -> 8 days earlier; 16-day -> 16 days earlier). If that tile is
  // empty the client reports honestly that no previous observation exists.
  const ndviPrev = isoAddDays(ndviDate, -ndviSpec.periodDays);

  let cloud: SatelliteLayer | null = null;
  try {
    const dates = await recentDates(CLOUD_SPEC);
    // Cloud fraction is a daily product; pick the newest day on record.
    const latest = dates.pop() ?? null;
    if (latest) {
      cloud = buildLayer(CLOUD_SPEC, latest, null);
    }
  } catch {
    cloud = null; // cloud coverage unavailable — UI says so honestly
  }

  const ndvi = buildLayer(ndviSpec, ndviDate, ndviPrev);

  const copernicusConfigured = Boolean(
    process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET
  );

  return {
    ok: true,
    ndvi,
    cloud,
    basemap: {
      source: "esri-world-imagery",
      tileUrl: ESRI_IMAGERY_URL,
      attribution:
        "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxZoom: 19,
    },
    copernicus: {
      // Sentinel-2 (10 m) is NOT wired up in this prototype: it needs OAuth
      // client credentials and a configured OGC instance on Copernicus Data
      // Space. We never claim it is available unless the proxy exists.
      connected: false,
      source: "copernicus-sentinel-2",
      note: copernicusConfigured
        ? "Credentials are present but the Sentinel-2 OGC proxy is not implemented yet."
        : "Not connected — requires Copernicus Data Space registration (free).",
    },
    fetchedAt: Date.now(),
  };
}