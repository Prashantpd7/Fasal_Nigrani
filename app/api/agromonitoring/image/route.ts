import { NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/server/rateLimit";
import { getProxiedImage } from "@/lib/server/agromonitoring";

export const runtime = "nodejs";

/**
 * GET /api/agromonitoring/image?polyid=...&dt=...
 *
 * AgroMonitoring asset URLs embed ?appid=KEY, so we never give them to the
 * browser. Instead the client asks for the image by polygon id + acquisition
 * time, and this route resolves + fetches it server-side. A missing/expired
 * image returns 404 and the UI shows "Data abhi available nahi hai." — never
 * a placeholder image.
 */
export async function GET(request: Request) {
  const key = clientKey(request);
  const rl = rateLimit(`agroimg:${key}`, 300, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rateLimited", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  const params = new URL(request.url).searchParams;
  const polyId = params.get("polyid");
  const dtRaw = params.get("dt");
  const dt = dtRaw ? Number(dtRaw) : NaN;
  if (!polyId || !Number.isFinite(dt) || dt <= 0) {
    return NextResponse.json({ error: "missingParams" }, { status: 400 });
  }

  const img = await getProxiedImage(polyId, dt);
  if (!img) {
    return NextResponse.json({ error: "notFound" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(img.data), {
    status: 200,
    headers: {
      "content-type": img.type,
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "content-length": String(img.data.byteLength),
    },
  });
}