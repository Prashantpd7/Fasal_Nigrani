/**
 * Soil testing (मिट्टी जाँच) — interpretation follows the Soil Health Card
 * (Soil Health Management, Dept. of Agriculture & Farmers Welfare) nutrient
 * bands and ICAR threshold tables; the lab listing links to official
 * government portals (Soil Health Card portal + ICAR KVK locator).
 *
 * Honest design: a farmer enters values from their Soil Health Card / field
 * test kit; the engine translates them into plain-language band + advice.
 * The engine NEVER prescribes a chemical dose — it points to official
 * guidance and a KVK.
 */
import { tLang } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import type { SoilInterpretation, SoilLab, SoilParams } from "@/lib/types";

export const SHC_PORTAL_URL = "https://www.soilhealth.dac.gov.in/";
export const KVK_LOCATOR_URL = "https://kvk.icar.gov.in/";

interface Band {
  labelKey: string;
  noteKey: string;
  kind: "low" | "medium" | "high" | "neutral" | "acidic" | "alkaline" | "saline";
  treatKey: string | null;
}

function pick(
  value: number | null,
  bands: { below: number; band: Band }[],
  fallbackBand: Band
): Band {
  if (value === null) return fallbackBand;
  for (const b of bands) {
    if (value < b.below) return b.band;
  }
  return fallbackBand;
}

const pH_BANDS: Band[] = [
  {
    labelKey: "soil.band.stronglyAcidic",
    noteKey: "soil.notes.phLow",
    kind: "acidic",
    treatKey: "soil.treat.phLow",
  },
  {
    labelKey: "soil.band.slightlyAcidic",
    noteKey: "soil.notes.phFine",
    kind: "neutral",
    treatKey: null,
  },
  {
    labelKey: "soil.band.neutral",
    noteKey: "soil.notes.phBest",
    kind: "neutral",
    treatKey: null,
  },
  {
    labelKey: "soil.band.alkaline",
    noteKey: "soil.notes.phHigh",
    kind: "alkaline",
    treatKey: "soil.treat.phHigh",
  },
  {
    labelKey: "soil.band.stronglyAlkaline",
    noteKey: "soil.notes.phVeryHigh",
    kind: "alkaline",
    treatKey: "soil.treat.phHigh",
  },
];

const EC_BANDS: Band[] = [
  {
    labelKey: "soil.band.normal",
    noteKey: "soil.notes.ecNormal",
    kind: "neutral",
    treatKey: null,
  },
  {
    labelKey: "soil.band.slightlySaline",
    noteKey: "soil.notes.ecSaline",
    kind: "saline",
    treatKey: "soil.treat.saline",
  },
  {
    labelKey: "soil.band.moderatelySaline",
    noteKey: "soil.notes.ecSaline",
    kind: "saline",
    treatKey: "soil.treat.saline",
  },
  {
    labelKey: "soil.band.stronglySaline",
    noteKey: "soil.notes.ecVerySaline",
    kind: "saline",
    treatKey: "soil.treat.saline",
  },
];

const OC_BANDS: Band[] = [
  {
    labelKey: "soil.band.low",
    noteKey: "soil.notes.ocLow",
    kind: "low",
    treatKey: "soil.treat.ocLow",
  },
  {
    labelKey: "soil.band.medium",
    noteKey: "soil.notes.ocMedium",
    kind: "medium",
    treatKey: null,
  },
  {
    labelKey: "soil.band.high",
    noteKey: "soil.notes.ocHigh",
    kind: "high",
    treatKey: null,
  },
];

const NPK_BANDS: Band[] = [
  {
    labelKey: "soil.band.low",
    noteKey: "soil.notes.nutrientLow",
    kind: "low",
    treatKey: "soil.treat.nutrientLow",
  },
  {
    labelKey: "soil.band.medium",
    noteKey: "soil.notes.nutrientMedium",
    kind: "medium",
    treatKey: null,
  },
  {
    labelKey: "soil.band.high",
    noteKey: "soil.notes.nutrientHigh",
    kind: "high",
    treatKey: null,
  },
];

/** ICAR / SHC reference thresholds converted to interpretation bands. */
function interpretParams(lang: Lang, p: SoilParams): SoilInterpretation {
  const pH = pick(p.ph, [
    { below: 5.5, band: pH_BANDS[0] },
    { below: 6.5, band: pH_BANDS[1] },
    { below: 7.5, band: pH_BANDS[2] },
    { below: 8.5, band: pH_BANDS[3] },
  ], pH_BANDS[2]);
  const ec = pick(p.ec, [
    { below: 1.0, band: EC_BANDS[0] },
    { below: 2.0, band: EC_BANDS[1] },
    { below: 4.0, band: EC_BANDS[2] },
  ], EC_BANDS[3]);
  const oc = pick(p.oc, [
    { below: 0.4, band: OC_BANDS[0] },
    { below: 0.75, band: OC_BANDS[1] },
  ], OC_BANDS[2]);
  const n = pick(p.n, [
    { below: 280, band: NPK_BANDS[0] },
    { below: 560, band: NPK_BANDS[1] },
  ], NPK_BANDS[2]);
  const p2 = pick(p.p, [
    { below: 22, band: NPK_BANDS[0] },
    { below: 56, band: NPK_BANDS[1] },
  ], NPK_BANDS[2]);
  const k = pick(p.k, [
    { below: 120, band: NPK_BANDS[0] },
    { below: 280, band: NPK_BANDS[1] },
  ], NPK_BANDS[2]);

  const bands = { ph: pH, ec, oc, n, p: p2, k };
  const factors = [
    { key: "ph", name: tLang(lang, "soil.param.ph"), unit: "", value: p.ph, sel: pH },
    { key: "ec", name: tLang(lang, "soil.param.ec"), unit: "dS/m", value: p.ec, sel: ec },
    { key: "oc", name: tLang(lang, "soil.param.oc"), unit: "%", value: p.oc, sel: oc },
    { key: "n", name: tLang(lang, "soil.param.n"), unit: "kg/ha", value: p.n, sel: n },
    { key: "p", name: tLang(lang, "soil.param.p"), unit: "kg/ha", value: p.p, sel: p2 },
    { key: "k", name: tLang(lang, "soil.param.k"), unit: "kg/ha", value: p.k, sel: k },
  ].map((f) => ({
    param: f.name,
    unit: f.unit,
    value: f.value,
    band: f.sel.kind,
    label: tLang(lang, f.sel.labelKey),
    note: f.value === null
      ? tLang(lang, "soil.notEntered")
      : tLang(lang, f.sel.noteKey),
    treat: f.sel.treatKey ? [tLang(lang, f.sel.treatKey)] : null,
  }));

  const healthyBand =
    bands.ph.kind === "neutral" &&
    bands.ec.kind === "neutral" &&
    (bands.oc.kind === "medium" || bands.oc.kind === "high");

  const suggestions: string[] = [];
  for (const f of factors) {
    if (f.treat) suggestions.push(...f.treat);
  }
  if (healthyBand && suggestions.length === 0) {
    suggestions.push(tLang(lang, "soil.treat.allGood"));
  }

  const summary = healthyBand
    ? tLang(lang, "soil.summary.good")
    : tLang(lang, "soil.summary.needsCare");

  return {
    factors,
    summary,
    suggestions: [...new Set(suggestions)].slice(0, 6),
    healthyBand,
  };
}

/** Government soil-testing access points shown under the lab section. */
function labsFor(lang: Lang, stateName: string): SoilLab[] {
  return [
    {
      name: tLang(lang, "soil.labDistrict"),
      district: tLang(lang, "soil.yourDistrict"),
      state: stateName,
      contact: tLang(lang, "soil.shcFree"),
      url: SHC_PORTAL_URL,
    },
    {
      name: "Krishi Vigyan Kendra (KVK)",
      district: tLang(lang, "soil.yourDistrict"),
      state: stateName,
      contact: tLang(lang, "soil.kvkContact"),
      url: KVK_LOCATOR_URL,
    },
  ];
}

export function interpretSoil(
  lang: Lang,
  params: SoilParams,
  stateName: string
) {
  const result = interpretParams(lang, params);
  return {
    source: "live" as const,
    fetchedAt: Date.now(),
    stateName,
    districtName: null as string | null,
    result,
    labs: labsFor(lang, stateName),
    shcUrl: SHC_PORTAL_URL,
    note: tLang(lang, "soil.noteBottom"),
  };
}