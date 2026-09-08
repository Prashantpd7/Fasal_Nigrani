import { NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/server/rateLimit";
import {
  agroConfigured,
  createFarmPolygon,
  getFarmMonitoring,
  AgroError,
} from "@/lib/server/agromonitoring";

export const runtime = "nodejs";

const MAX_RING_POINTS = 60;

function sanitizeRing(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > MAX_RING_POINTS) {
    return null;
  }
  const ring: [number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length !== 2) return null;
    const lat = Number(p[0]);
    const lon = Number(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    ring.push([lat, lon]);
  }
  // Duplicate consecutive points break GeoJSON validity.
  const cleaned: [number, number][] = [];
  for (const pt of ring) {
    const last = cleaned[cleaned.length - 1];
    if (last && last[0] === pt[0] && last[1] === pt[1]) continue;
    cleaned.push(pt);
  }
  return cleaned.length >= 3 ? cleaned : null;
}

function sanitizeName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return (s || "Fasal Nigrani farm").slice(0, 80);
}

function sanitizePolyId(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9]{8,40}$/.test(raw) ? raw : null;
}

/**
 * AgroMonitoring integration (§ Farm — field-level monitoring).
 *
 * POST /api/agromonitoring  { name?, ring: [lat,lon][] }  -> registers the
 *   drawn farm polygon with AgroMonitoring and returns its polygon id
 *   ({ ok, polyId, areaHa, center }). The id is cached client-side so we
 *   reuse it instead of re-creating polygons on every visit.
 *
 * GET  /api/agromonitoring?polyid=...  -> real NDVI history, latest imagery
 *   and soil estimate for that polygon. On failure returns a clearly-labelled
 *   payload (never invented numbers).
 *
 * The API key never leaves this server.
 */
export async function POST(request: Request) {
  const key = clientKey(request);
  const rl = rateLimit(`agro:${key}`, 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rateLimited", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  if (!agroConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: "not_configured",
      message:
        "AgroMonitoring is not connected. Add AGROMONITORING_API_KEY to your .env file and restart. See SETUP-REPORT-AGRO.md.",
    });
  }

  let body: { name?: unknown; ring?: unknown; polyId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "badRequest" }, { status: 400 });
  }

  const ring = sanitizeRing(body.ring);
  if (!ring) {
    return NextResponse.json(
      { ok: false, error: "invalidPolygon", message: "Farm polygon needs 3–60 valid points." },
      { status: 400 }
    );
  }
  const polyId = sanitizePolyId(body.polyId);
  const name = sanitizeName(body.name);

  try {
    const created = await createFarmPolygon(name, ring, polyId);
    return NextResponse.json(
      {
        ok: true,
        configured: true,
        polyId: created.id,
        areaHa: created.areaHa,
        center: created.center,
      },
      {
        headers: { "cache-control": "no-store" },
      }
    );
  } catch (e) {
    const ae = e as AgroError;
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error: ae.kind,
        message: "AgroMonitoring could not register this farm right now.",
      },
      { status: 502 }
    );
  }
}

export async function GET(request: Request) {
  const key = clientKey(request);
  const rl = rateLimit(`agro:${key}`, 120, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rateLimited", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  const polyId = sanitizePolyId(
    new URL(request.url).searchParams.get("polyid")
  );
  if (!polyId) {
    return NextResponse.json(
      { ok: false, error: "missingPolyId" },
      { status: 400 }
    );
  }

  const payload = await getFarmMonitoring(polyId);
  if (payload.error === "not_configured") {
    return NextResponse.json(payload, { status: 503 });
  }
  // 4xx-level problems (invalid key, rate limit) get a real HTTP status so
  // developer logs can see it; the payload stays honest either way.
  const status =
    payload.error === "invalid_key" || payload.error === "rate_limited"
      ? 502
      : 200;
  return NextResponse.json(payload, {
    status,
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
}