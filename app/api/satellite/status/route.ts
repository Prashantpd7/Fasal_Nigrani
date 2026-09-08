import { NextResponse } from "next/server";
import { getSatelliteStatus } from "@/lib/server/satelliteService";
import { rateLimit, clientKey } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

/**
 * Satellite status (§ Farm — satellite): real layer configuration + observation
 * dates from NASA GIBS. The client uses this to draw tiles and to decode
 * NDVI/cloud values — nothing here is ever fabricated. On failure we return a
 * clearly-labelled "unavailable" payload so the UI can say "Data abhi
 * available nahi hai" instead of inventing numbers.
 */
export async function GET(request: Request) {
  const key = clientKey(request);
  const rl = rateLimit(`sat:${key}`, 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rateLimited", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  try {
    const status = await getSatelliteStatus();
    return NextResponse.json(status, {
      headers: { "cache-control": "public, max-age=300, s-maxage=300" },
    });
  } catch {
    // Honest failure: the farmer sees "satellite data not available", never
    // a fake image or a made-up NDVI value.
    return NextResponse.json({
      ok: false,
      ndvi: null,
      cloud: null,
      basemap: {
        source: "esri-world-imagery",
        tileUrl:
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution:
          "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 19,
      },
      copernicus: {
        connected: false,
        source: "copernicus-sentinel-2",
        note: "Satellite data source is not reachable right now.",
      },
      fetchedAt: Date.now(),
    });
  }
}