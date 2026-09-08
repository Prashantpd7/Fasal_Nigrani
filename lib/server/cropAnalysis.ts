import type { Lang } from "@/lib/i18n";
import { extractJsonObject } from "./prompts";
import {
  GENERIC_SOURCE,
  genericSteps,
  toKnowledgeMatch,
  verifyConditions,
} from "./agricultureKnowledge";
import { getPlantIdSignal, type PlantIdSignal } from "./plantId";
import type {
  AnalysisResult,
  Category,
  ConditionType,
  Confidence,
  HealthStatus,
  SuspectedCondition,
  VerificationLevel,
} from "@/lib/types";

/**
 * Crop analysis pipeline (§ Crop analysis):
 *
 *   Farmer images -> validation (route) -> Gemini vision (strict JSON)
 *   -> trusted ICAR/KVK knowledge verification -> confidence calculation
 *   -> safe recommendation -> farmer-friendly result.
 *
 * The vision model never supplies management steps or doses — those come only
 * from the knowledge base. If nothing reliably verifies, we say so.
 */

const QUALITY_ISSUES = ["too_blurry", "too_dark", "subject_too_far", "not_a_plant"];
const CROP_IDS = [
  "wheat", "mustard", "bajra", "maize", "cotton", "chickpea", "cumin",
  "rice", "tomato", "potato", "chilli", "onion", "groundnut", "sugarcane", "other",
];

const asString = (v: unknown): string | null =>
  typeof v === "string" ? v.trim().slice(0, 300) : null;

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asStringArray(v: unknown, max = 4): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, max);
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

interface VisionRaw {
  image_quality_ok: boolean;
  quality_issue: AnalysisResult["quality_issue"];
  crop: string | null;
  health: HealthStatus;
  suspected_conditions: SuspectedCondition[];
  confidence_pct: number;
  observations: string[];
  ask_more_photos: string[];
  needs_expert: boolean;
  product_mentioned: { name: string; kind: string } | null;
}

/** Parse + validate the model's JSON reply. Returns null on malformed JSON. */
export function parseVisionJson(rawText: string): VisionRaw | null {
  let obj: Record<string, unknown>;
  try {
    const candidate = extractJsonObject(rawText);
    if (!candidate) return null;
    obj = JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }

  const qualityIssueRaw = asString(obj.quality_issue);
  const quality_issue = QUALITY_ISSUES.includes(qualityIssueRaw ?? "")
    ? (qualityIssueRaw as VisionRaw["quality_issue"])
    : null;
  const image_quality_ok =
    typeof obj.image_quality_ok === "boolean" ? obj.image_quality_ok : true;

  const cropRaw = asString(obj.crop);
  const crop = cropRaw && CROP_IDS.includes(cropRaw) ? cropRaw : null;

  const healthRaw = asString(obj.health) as HealthStatus | null;
  const health: HealthStatus =
    healthRaw === "healthy" || healthRaw === "stress" || healthRaw === "unhealthy"
      ? healthRaw
      : "unclear";

  const conditions: SuspectedCondition[] = [];
  if (Array.isArray(obj.suspected_conditions)) {
    for (const c of obj.suspected_conditions.slice(0, 2)) {
      if (!c || typeof c !== "object") continue;
      const rec = c as Record<string, unknown>;
      const name = asString(rec.name);
      if (!name) continue;
      const typeRaw = asString(rec.type);
      const type: ConditionType =
        typeRaw === "disease" || typeRaw === "pest" || typeRaw === "nutrient" ||
        typeRaw === "stress" || typeRaw === "other"
          ? typeRaw
          : "other";
      conditions.push({
        name,
        type,
        symptoms_observed: asStringArray(rec.symptoms_observed, 3),
        confidence_pct:
          typeof rec.confidence_pct === "number"
            ? clampPct(rec.confidence_pct)
            : null,
      });
    }
  }

  let product: VisionRaw["product_mentioned"] = null;
  const prodRaw = obj.product_mentioned as Record<string, unknown> | null;
  if (prodRaw && typeof prodRaw === "object") {
    const pname = asString(prodRaw.name);
    const kindRaw = asString(prodRaw.kind);
    if (pname) {
      product = {
        name: pname,
        kind:
          kindRaw === "pesticide" || kindRaw === "fertilizer" ? kindRaw : "other",
      };
    }
  }

  return {
    image_quality_ok,
    quality_issue: image_quality_ok ? null : quality_issue,
    crop,
    health,
    suspected_conditions: conditions,
    confidence_pct: clampPct(asNumber(obj.confidence_pct, 0)),
    observations: asStringArray(obj.observations, 3),
    ask_more_photos: asStringArray(obj.ask_more_photos, 3),
    needs_expert:
      typeof obj.needs_expert === "boolean" ? obj.needs_expert : false,
    product_mentioned: product,
  };
}

const CROP_LABELS: Record<string, Bilingual> = {
  wheat: { en: "Wheat", hi: "गेहूँ" },
  mustard: { en: "Mustard", hi: "सरसों" },
  bajra: { en: "Pearl millet (Bajra)", hi: "बाजरा" },
  maize: { en: "Maize", hi: "मक्का" },
  cotton: { en: "Cotton", hi: "कपास" },
  chickpea: { en: "Chickpea (Chana)", hi: "चना" },
  cumin: { en: "Cumin (Jeera)", hi: "जीरा" },
  rice: { en: "Rice", hi: "धान" },
  tomato: { en: "Tomato", hi: "टमाटर" },
  potato: { en: "Potato", hi: "आलू" },
  chilli: { en: "Chilli", hi: "मिर्च" },
  onion: { en: "Onion", hi: "प्याज़" },
  groundnut: { en: "Groundnut", hi: "मूँगफली" },
  sugarcane: { en: "Sugarcane", hi: "गन्ना" },
  other: { en: "Other crop", hi: "अन्य फसल" },
};

interface Bilingual {
  en: string;
  hi: string;
}

function pick(b: Bilingual, lang: Lang): string {
  return lang === "hi" ? b.hi : b.en;
}

/** Final confidence after knowledge verification (0-100). */
function finalConfidence(
  model: number,
  level: VerificationLevel | null,
  qualityOk: boolean
): number {
  if (!qualityOk) return Math.min(15, Math.round(model * 0.2));
  if (!level) return Math.min(35, Math.round(model * 0.5));
  if (level === "verified") return model;
  if (level === "likely") return Math.max(0, model - 10);
  return Math.min(35, Math.round(model * 0.5));
}

function toConfidence(pct: number): Confidence {
  if (pct >= 70) return "high";
  if (pct >= 40) return "medium";
  return "low";
}

/** Map health + top condition type to the legacy Category. */
function toCategory(health: HealthStatus, topType: ConditionType | null): Category {
  if (health === "healthy") return "looks_healthy";
  if (health === "unhealthy") {
    if (topType === "pest") return "pest_damage";
    if (topType === "nutrient") return "nutrient_deficiency";
    if (topType === "stress") return "water_stress";
    return "disease";
  }
  if (health === "stress") {
    if (topType === "nutrient") return "nutrient_deficiency";
    return "water_stress";
  }
  return "unclear";
}

/**
 * Assemble the final AnalysisResult from the raw vision output + knowledge
 * verification. `configured` must be true (the route refuses to run without
 * a model key).
 */
export function buildResult(
  raw: VisionRaw,
  lang: Lang,
  imagesAnalyzed: number,
  plantId: PlantIdSignal | null
): AnalysisResult {
  const { match } = verifyConditions(raw.crop, raw.suspected_conditions);
  const level: VerificationLevel | null = match ? match.level : null;

  const confidence_pct = finalConfidence(raw.confidence_pct, level, raw.image_quality_ok);
  const topType = raw.suspected_conditions[0]?.type ?? null;

  const health = raw.image_quality_ok ? raw.health : "unclear";
  const cropLabel = raw.crop ? pick(CROP_LABELS[raw.crop] ?? CROP_LABELS.other, lang) : null;

  // Recommended action: knowledge base management (or generic when nothing
  // verifies, or routine care when the plant looks healthy).
  let recommended_action: string[];
  let source = GENERIC_SOURCE;
  let warning: string | null = null;
  let verification_note: string | null = null;
  let knowledge: AnalysisResult["knowledge"] = [];
  let likelyProblem: string | null = null;

  if (!raw.image_quality_ok) {
    recommended_action =
      lang === "hi"
        ? [
            "फोटो साफ़ नहीं है — कृपया अच्छी रोशनी में पास से दोबारा फोटो लें।",
            "पत्ती, तना, फल और पत्ती के नीचे की तरफ़ की फोटो भेजें।",
            "फोटो न सुधरे तो नमूना अपने KVK में दिखाएँ।",
          ]
        : [
            "The photo is not clear — please retake it close-up in good light.",
            "Send photos of the leaf, stem, fruit and the underside of the leaf.",
            "If it stays unclear, show a sample to your KVK.",
          ];
    warning =
      lang === "hi"
        ? "फोटो साफ़ न होने पर कोई दवा बिना विशेषज्ञ की सलाह के न डालें।"
        : "Do not apply any chemical based on an unclear photo without expert advice.";
    verification_note =
      lang === "hi"
        ? "यह फोटो विश्वसनीय निदान के लिए पर्याप्त नहीं है।"
        : "The image is not sufficient for a reliable diagnosis.";
  } else if (health === "healthy") {
    recommended_action =
      lang === "hi"
        ? [
            "रोज़ की देखभाल जारी रखें — नियमित पानी और निराई।",
            "हफ़्ते में 1–2 बार पत्तियों के नीचे भी देखें।",
            "कुछ बदलाव दिखे तो तुरंत नई फोटो भेजें।",
          ]
        : [
            "Keep up routine care — regular water and weeding.",
            "Check under the leaves once or twice a week too.",
            "If anything changes, send a new photo right away.",
          ];
    source = GENERIC_SOURCE;
    verification_note = null;
  } else if (match) {
    const km = toKnowledgeMatch(match.entry, match.level, lang);
    knowledge = [km];
    recommended_action = km.management;
    warning = km.warning;
    source = km.source;
    likelyProblem = km.conditionName;
    verification_note =
      match.level === "uncertain"
        ? lang === "hi"
          ? "इस स्थिति की पुष्टि भरोसेमंद स्रोत से नहीं हो पाई — संभावित विकल्प भी जाँचें।"
          : "This condition could not be reliably verified against the trusted knowledge base — consider the possible alternatives."
        : null;
  } else {
    // No knowledge match: be honest, use generic safe steps.
    recommended_action = genericSteps(lang);
    source = GENERIC_SOURCE;
    verification_note =
      lang === "hi"
        ? "बताई गई समस्या भरोसेमंद कृषि स्रोत से मेल नहीं खाई — इसकी पुष्टि नहीं हो सकी।"
        : "The suspected condition could not be reliably verified against the trusted agricultural source.";
    warning =
      lang === "hi"
        ? "पुष्टि न होने तक कोई दवा या रसायन न डालें — पहले KVK/विशेषज्ञ से पुष्टि करें।"
        : "Do not apply any chemical until the condition is confirmed by a KVK/expert.";
  }

  if (!likelyProblem && raw.suspected_conditions[0]) {
    likelyProblem = raw.suspected_conditions[0].name;
  }

  const problemPart = likelyProblem ? `: ${likelyProblem}` : "";
  const cropPart = cropLabel ? ` ${cropLabel}` : "";
  const explanation_simple =
    lang === "hi"
      ? `फसल${cropPart}${problemPart} (भरोसा ${confidence_pct}%)। ${raw.observations.join(" ")}`
      : `Crop${cropPart}${problemPart} (confidence ${confidence_pct}%). ${raw.observations.join(" ")}`;

  const plantIdBlock: AnalysisResult["plantId"] = plantId
    ? {
        used: plantId.used,
        isHealthy: plantId.isHealthy,
        topName: plantId.topName,
        topProbability: plantId.topProbability,
        agreement: plantIdAgreement(health, plantId),
      }
    : null;

  const needsExpert =
    raw.needs_expert ||
    confidence_pct < 40 ||
    health === "unhealthy";

  const ask_more_photos = raw.ask_more_photos;

  return {
    image_quality_ok: raw.image_quality_ok,
    quality_issue: raw.image_quality_ok ? null : raw.quality_issue,
    crop: raw.crop,
    cropLabel,
    health,
    likely_problem: likelyProblem,
    confidence_pct,
    confidence: toConfidence(confidence_pct),
    why: raw.observations,
    recommended_action,
    warning,
    source,
    verification: level ?? "uncertain",
    verification_note,
    ask_more_photos,
    needs_expert: needsExpert,
    product_mentioned: raw.product_mentioned,
    knowledge,
    explanation_simple,
    plantId: plantIdBlock,
    images_analyzed: imagesAnalyzed,
    configured: true,
    // Backwards-compatible aliases.
    likely_category: toCategory(health, topType),
    possible_specific_issue: likelyProblem,
    seek_expert_advice: needsExpert,
    better_photo_tip:
      ask_more_photos.length > 0 ? ask_more_photos.join(", ") : null,
    what_to_do_now: recommended_action,
    what_to_avoid:
      warning !== null
        ? [warning]
        : lang === "hi"
          ? ["बिना पुष्टि के कोई दवा न डालें।"]
          : ["Do not apply chemicals without confirmation."],
  };
}

/** Compare Plant.id health verdict with ours (agree/disagree/unknown). */
function plantIdAgreement(
  ourHealth: HealthStatus,
  signal: PlantIdSignal
): "agree" | "disagree" | null {
  if (signal.isHealthy === null) return null;
  const oursHealthy = ourHealth === "healthy";
  return oursHealthy === signal.isHealthy ? "agree" : "disagree";
}

export { getPlantIdSignal };