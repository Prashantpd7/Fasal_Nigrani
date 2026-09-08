import type { CropId } from "./types";

/**
 * Simple crop catalog (§ Farm — crop selection). Farmer-facing names in both
 * languages; no scientific names required. "other" is always available so a
 * crop outside this list never blocks the dashboard.
 */
export interface CropRec {
  id: CropId;
  en: string;
  hi: string;
  emoji: string;
}

export const CROPS: CropRec[] = [
  { id: "wheat", en: "Wheat", hi: "गेहूँ", emoji: "🌾" },
  { id: "mustard", en: "Mustard", hi: "सरसों", emoji: "🌼" },
  { id: "bajra", en: "Pearl millet (Bajra)", hi: "बाजरा", emoji: "🌾" },
  { id: "maize", en: "Maize", hi: "मक्का", emoji: "🌽" },
  { id: "cotton", en: "Cotton", hi: "कपास", emoji: "☁️" },
  { id: "chickpea", en: "Chickpea (Chana)", hi: "चना", emoji: "🫘" },
  { id: "cumin", en: "Cumin (Jeera)", hi: "जीरा", emoji: "🌿" },
  { id: "other", en: "Other", hi: "अन्य", emoji: "🌱" },
];

export function cropName(c: CropRec, lang: "hi" | "en"): string {
  return lang === "hi" ? c.hi : c.en;
}

export function cropById(id: CropId | null): CropRec | null {
  if (!id) return null;
  return CROPS.find((c) => c.id === id) ?? null;
}

/**
 * Conservative, well-documented crop profiles used ONLY to hedge generic
 * weather/satellite advice (e.g. cumin is sensitive to standing water). These
 * never override a measured value and never produce a brand/dose suggestion.
 */
export interface CropProfile {
  /** High water-demand crops suffer quickly in a dry hot spell. */
  highWaterDemand: boolean;
  /** Standing water damages these crops quickly (waterlogging risk). */
  waterlogSensitive: boolean;
}

export function cropProfile(id: CropId): CropProfile {
  switch (id) {
    case "wheat":
      return { highWaterDemand: true, waterlogSensitive: true };
    case "mustard":
      return { highWaterDemand: false, waterlogSensitive: true };
    case "bajra":
      return { highWaterDemand: false, waterlogSensitive: false };
    case "maize":
      return { highWaterDemand: true, waterlogSensitive: true };
    case "cotton":
      return { highWaterDemand: false, waterlogSensitive: true };
    case "chickpea":
      return { highWaterDemand: false, waterlogSensitive: true };
    case "cumin":
      return { highWaterDemand: false, waterlogSensitive: true };
    default:
      return { highWaterDemand: false, waterlogSensitive: false };
  }
}