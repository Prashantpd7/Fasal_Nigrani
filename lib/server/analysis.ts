import { tLang } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { extractJsonObject } from "./prompts";
import type {
  AnalysisResult,
  Category,
  Confidence,
} from "@/lib/types";

const CATEGORIES: Category[] = [
  "disease",
  "pest_damage",
  "water_stress",
  "nutrient_deficiency",
  "physical_damage",
  "unclear",
  "looks_healthy",
];
const CONFIDENCES: Confidence[] = ["low", "medium", "high"];
const QUALITY_ISSUES = ["too_blurry", "too_dark", "subject_too_far", "not_a_plant"];

const asString = (v: unknown): string | null =>
  typeof v === "string" ? v.trim().slice(0, 700) : null;
const asStringArray = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 5);
};

export function parseAnalysis(rawText: string, lang: Lang): AnalysisResult | null {
  let obj: Record<string, unknown>;
  try {
    const candidate = extractJsonObject(rawText);
    if (!candidate) return null;
    obj = JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }

  const category: Category = CATEGORIES.includes(obj.likely_category as Category)
    ? (obj.likely_category as Category)
    : "unclear";
  const confidence: Confidence = CONFIDENCES.includes(
    obj.confidence as Confidence
  )
    ? (obj.confidence as Confidence)
    : "low";

  const qualityIssueRaw = asString(obj.quality_issue);
  const quality_issue = QUALITY_ISSUES.includes(qualityIssueRaw ?? "")
    ? (qualityIssueRaw as AnalysisResult["quality_issue"])
    : null;
  const image_quality_ok =
    typeof obj.image_quality_ok === "boolean"
      ? obj.image_quality_ok
      : quality_issue !== null
        ? false
        : true;

  const explanation_simple =
    asString(obj.explanation_simple) ?? tLang(lang, "photo.categories.unclear");
  const what_to_do_now = asStringArray(obj.what_to_do_now);
  const what_to_avoid = asStringArray(obj.what_to_avoid);
  const seek_expert_advice =
    confidence === "low" ||
    (typeof obj.seek_expert_advice === "boolean" && obj.seek_expert_advice === true);

  return {
    image_quality_ok,
    quality_issue: image_quality_ok ? null : quality_issue,
    likely_category: image_quality_ok ? category : "unclear",
    possible_specific_issue: image_quality_ok
      ? asString(obj.possible_specific_issue)
      : null,
    confidence,
    explanation_simple,
    what_to_do_now:
      what_to_do_now.length > 0
        ? what_to_do_now
        : [tLang(lang, "common.expertLine")],
    what_to_avoid: what_to_avoid.length > 0 ? what_to_avoid : [],
    seek_expert_advice,
    better_photo_tip: asString(obj.better_photo_tip),
  };
}
