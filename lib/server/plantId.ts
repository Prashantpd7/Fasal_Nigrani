import type { ImagePart } from "./ai";

/**
 * Optional Plant.id signal (§ Crop analysis — verification).
 *
 * Plant.id is a paid, machine-learning disease service. When
 * PLANT_ID_API_KEY is configured we call it as ONE additional signal and
 * compare it against the Gemini + knowledge-base result. It is NEVER treated
 * as truth: if it disagrees with the verified pipeline, the farmer is told
 * verification is required. Any failure here is swallowed — the main pipeline
 * never depends on it.
 */

export function plantIdConfigured(): boolean {
  return Boolean(process.env.PLANT_ID_API_KEY);
}

export interface PlantIdSignal {
  used: boolean;
  isHealthy: boolean | null;
  topName: string | null;
  topProbability: number | null;
  error: string | null;
}

export async function getPlantIdSignal(
  images: ImagePart[],
  lat: number | null,
  lon: number | null
): Promise<PlantIdSignal> {
  const base =
    process.env.PLANT_ID_API_URL ?? "https://api.plant.id/v2/health_assessment";
  const key = process.env.PLANT_ID_API_KEY;
  if (!key) {
    return { used: false, isHealthy: null, topName: null, topProbability: null, error: null };
  }
  try {
    const body: Record<string, unknown> = {
      images: images.map((i) => i.base64),
      disease_details: ["common_names", "description", "treatment"],
      language: "en",
    };
    if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
      body.latitude = lat;
      body.longitude = lon;
    }
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`Plant.id HTTP ${res.status}`);
    const j = (await res.json()) as {
      is_healthy?: { is_healthy?: boolean; probability?: number };
      disease?: { suggestions?: { name?: string; probability?: number }[] };
    };
    const isHealthy =
      typeof j.is_healthy?.is_healthy === "boolean"
        ? j.is_healthy.is_healthy
        : null;
    const top = j.disease?.suggestions?.[0];
    return {
      used: true,
      isHealthy,
      topName: top?.name ?? null,
      topProbability:
        typeof top?.probability === "number" ? Math.round(top.probability * 100) : null,
      error: null,
    };
  } catch (e) {
    return {
      used: true,
      isHealthy: null,
      topName: null,
      topProbability: null,
      error: e instanceof Error ? e.message : "plantid error",
    };
  }
}