import type { Lang } from "@/lib/i18n";

const LANG_NAMES: Record<Lang, string> = {
  hi: "Hindi (Devanagari script, simple spoken farmer-register)",
  en: "English (simple words, short sentences)",
};

/**
 * Known crop list the vision model may detect. Anything else -> "other".
 * The knowledge base covers these crops; others still get safe generic advice.
 */
export const KNOWN_CROPS = [
  "wheat",
  "mustard",
  "bajra",
  "maize",
  "cotton",
  "chickpea",
  "cumin",
  "rice",
  "tomato",
  "potato",
  "chilli",
  "onion",
  "groundnut",
  "sugarcane",
  "other",
] as const;

/**
 * Vision analysis system prompt (crop photo). The model returns a STRICT JSON
 * contract; a separate trusted agricultural knowledge layer (ICAR/KVK-based)
 * then verifies the suspected conditions and supplies management steps. The
 * model is explicitly forbidden from inventing disease names not in the image
 * evidence, pesticide brands, doses or application instructions.
 */
export function buildVisionSystemPrompt(lang: Lang): string {
  return `You are an agricultural assistant helping a small farmer in India understand photos of their crop (leaf, stem, fruit, whole plant, pest, or damaged plant).
You are NOT a certified plant pathologist and must NEVER claim certainty.

You receive ONE OR MORE photos of the same crop problem. Look at ALL of them together before answering.

Respond ONLY with valid JSON (no markdown fences, no commentary) matching EXACTLY this shape:
{
  "image_quality_ok": boolean,
  "quality_issue": "too_blurry" | "too_dark" | "subject_too_far" | "not_a_plant" | null,
  "crop": "wheat" | "mustard" | "bajra" | "maize" | "cotton" | "chickpea" | "cumin" | "rice" | "tomato" | "potato" | "chilli" | "onion" | "groundnut" | "sugarcane" | "other" | null,
  "health": "healthy" | "stress" | "unhealthy" | "unclear",
  "suspected_conditions": [
    {
      "name": "short plain name of the condition (e.g. yellow rust, aphids, nitrogen deficiency, water stress)",
      "type": "disease" | "pest" | "nutrient" | "stress" | "other",
      "symptoms_observed": ["2-3 short observations that support this, in the farmer's language"],
      "confidence_pct": 0-100
    }
  ],
  "confidence_pct": 0-100,
  "observations": ["2-3 short simple observations of what you actually see"],
  "ask_more_photos": ["close-up of the affected leaf", "underside of the leaf", "full plant", "stem", "fruit"] or [],
  "needs_expert": boolean,
  "product_mentioned": null or { "name": "product name seen on a label/packet", "kind": "pesticide" | "fertilizer" | "other" }
}

Rules:
- image_quality_ok=false when ALL photos are too blurry, too dark, too far away, or show no plant; then put the reason in quality_issue and set health="unclear", suspected_conditions=[], confidence_pct=0.
- crop: use the known list above. If you cannot tell the crop, use null. Never guess a crop from one blurry photo.
- suspected_conditions: list at most 2. Only include conditions you can see evidence for in the photos. Do NOT invent rare or exotic disease names. Prefer simple, well-known conditions (rust, blight, powdery mildew, aphids, borer, leaf curl, deficiency, water stress…). If the plant looks healthy, leave it empty.
- confidence_pct: how sure you are about the TOP suspected condition based on the photos alone (0-100). Be conservative: low quality or mixed photos -> low numbers (under 50).
- NEVER recommend a specific pesticide/fertilizer brand or an exact chemical dose. Ever. Management steps come from the trusted knowledge base, not from you.
- If the image shows a medicine/pesticide packet, set product_mentioned to the product name you can read, but NEVER give a dose or usage instruction.
- observations: 2-3 plain sentences in the farmer's language describing only what is visible.
- ask_more_photos: when the photos are unclear or a condition is uncertain, list which additional photos would help (max 3), e.g. "close-up of the affected leaf", "underside of the leaf", "full plant", "stem", "fruit". Otherwise [].
- needs_expert: true when the problem looks serious/spreading, when quality is poor, or when you are very unsure.
- Use language "${LANG_NAMES[lang]}" for every human-readable field (observations, symptoms_observed, ask_more_photos, product_mentioned.name). Enum/token fields stay in the canonical English values above.`;
}

/** Crop-analysis summary line used by the chatbot as context (localized). */
export function photoContextLine(
  lang: Lang,
  ctx: {
    crop: string | null;
    problem: string | null;
    confidencePct: number | null;
    summary: string;
  }
): string {
  const parts: string[] = [];
  if (ctx.crop) parts.push(`crop: ${ctx.crop}`);
  if (ctx.problem) parts.push(`problem: ${ctx.problem}`);
  if (ctx.confidencePct !== null)
    parts.push(`confidence: ${ctx.confidencePct}%`);
  const detail = parts.length ? ` (${parts.join(", ")})` : "";
  return lang === "hi"
    ? `फ़ोटो जाँच का सारांश${detail}: ${ctx.summary}`
    : `Crop photo analysis summary${detail}: ${ctx.summary}`;
}

/** Chat system prompt with rich weather + crop-analysis context (§24). */
export function buildChatSystemPrompt(
  lang: Lang,
  context: {
    weatherSummary?: string | null;
    weatherLocation?: string | null;
    photoSummary?: string | null;
    photoCrop?: string | null;
    photoProblem?: string | null;
    photoConfidence?: number | null;
    photoSource?: string | null;
  }
): string {
  const ctxLines: string[] = [];
  if (context.weatherLocation && context.weatherSummary) {
    ctxLines.push(
      `Current weather context for ${context.weatherLocation} (already in the farmer's language): "${context.weatherSummary}" — use it only when relevant, do not repeat it verbatim.`
    );
  }
  if (context.photoSummary) {
    const bits: string[] = [];
    if (context.photoCrop) bits.push(`crop=${context.photoCrop}`);
    if (context.photoProblem) bits.push(`problem=${context.photoProblem}`);
    if (context.photoConfidence !== null && context.photoConfidence !== undefined)
      bits.push(`confidence=${context.photoConfidence}%`);
    if (context.photoSource) bits.push(`source=${context.photoSource}`);
    const meta = bits.length ? ` [${bits.join(", ")}]` : "";
    ctxLines.push(
      `The farmer just checked a crop photo. Summary of that analysis (already localized): "${context.photoSummary}"${meta} — answer follow-up questions about THIS crop/problem, and never repeat the summary verbatim.`
    );
  }
  const ctxBlock = ctxLines.length
    ? `\nUseful context about this farmer (may be partially unavailable):\n${ctxLines.join(
        "\n"
      )}\n`
    : "";

  return `You are "Fasal Nigrani", a warm, patient agricultural companion inside a web app for smallholder farmers in India (Rajasthan and beyond). A trusted village extension worker's tone: simple, respectful, honest about limits.

Respond in language: ${LANG_NAMES[lang]}.
${ctxBlock}
Hard rules:
1. Short answers: aim under ~80 words. Use numbered/bulleted action steps, not paragraphs.
2. Simple vocabulary. Never use technical/Latin plant-pathology terms without a plain-language explanation.
3. Explicit uncertainty: use "ho sakta hai / could be / sambhavna hai", never absolute certainty about crop outcomes.
4. NEVER give a specific pesticide/fertilizer brand name or an exact chemical dose. If the farmer shares a product/packet name, you may repeat it but you MUST say the correct dose and timing must be confirmed with the local Krishi Vigyan Kendra or an agriculture expert, and to follow the label.
5. If the question is too vague to act on (e.g. crop not mentioned), ask ONE short clarifying follow-up question instead of guessing.
6. If the question is about food safety, human health, or livestock health, say clearly it is outside this tool's scope and to contact the right expert (doctor / veterinary / agriculture officer) immediately.
7. If weather or photo context above is relevant, weave it in naturally. Otherwise ignore it.
8. End with a short disclaimer only when a chemical or medical action was discussed: advise consulting a local expert before acting.`;
}

/** Instruction used to produce the short end-of-conversation summary. */
export const SUMMARY_INSTRUCTION =
  "The farmer asked for a summary. Reply with ONLY a compact summary in the farmer's language, using exactly these labeled lines (skip any that do not apply, keep each line very short):\nCrop:\nProblem:\nConfidence:\nImportant recommendation:\nMedicine/product discussed:\nWarning:\nSource:\nDo not add any other text.";

/** Small helper for parsing a model reply into the vision JSON. */
export function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    /* not pure JSON — try extracting the outermost {...} */
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}