import { NextResponse } from "next/server";
import type { Lang } from "@/lib/i18n";
import {
  getDemoWeather,
  getWeather,
  WeatherFetchError,
} from "@/lib/server/weatherService";

export const runtime = "nodejs";

function sanitizeLang(raw: string | null): Lang {
  return raw === "en" ? "en" : "hi";
}

/**
 * Weather API (§17). Numbers flow: Open-Meteo -> deterministic rules engine
 * -> localized plain-language payload. Zero LLM calls. If live Open-Meteo is
 * unreachable (or DEMO_MODE=true) the same rules engine runs on demo data and
 * the payload honestly reports source:"demo" so the UI can label it.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const lang = sanitizeLang(searchParams.get("lang"));
  const locationName = searchParams.get("location") || "";
  const placeKey = searchParams.get("place") || "place";

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: "invalid_location", message: "lat/lon required" },
      { status: 400 }
    );
  }

  try {
    if (process.env.DEMO_MODE === "true") {
      return NextResponse.json(getDemoWeather(placeKey, lang, locationName));
    }
    const payload = await getWeather(lat, lon, lang, locationName);
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof WeatherFetchError) {
      // Poor network fallback (§28): serve clearly-labelled demo data rather
      // than nothing.
      return NextResponse.json(getDemoWeather(placeKey, lang, locationName));
    }
    return NextResponse.json(
      { error: "server", message: "weather service error" },
      { status: 502 }
    );
  }
}
