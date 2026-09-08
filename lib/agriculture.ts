import type { CropHealthStatus, ForecastDay, Severity } from "./types";
import type { CropId } from "./types";
import { cropProfile } from "./crops";

/**
 * Agricultural intelligence engine (§ Farm — insights). Pure + deterministic:
 * given measured numbers it ALWAYS produces the same structured outcome with
 * zero LLM calls and zero invented values. Every conclusion is phrased as a
 * hedge ("ho sakta hai") and every claim traces back to a real number:
 *
 *  - Weather numbers come from Open-Meteo (via WeatherPayload).
 *  - NDVI numbers come from NASA GIBS tiles (decoded from the satellite
 *    colormap on the client — never guessed).
 *  - The crop only adds conservative, generic knowledge (e.g. cumin is
 *    sensitive to standing water) — never a diagnosis or a chemical dose.
 *
 * NDVI is a vegetation-greenness proxy. A low value can mean bare soil,
 * sparse cover, a young crop or a stressed crop — satellite alone cannot tell
 * which, so the engine always lists possible reasons instead of choosing one.
 */

export interface AgriInput {
  crop: CropId;
  /** Maximum rain probability (%) in the next 24h. */
  rainProbNext24: number | null;
  /** Total rain (mm) expected in the next 24h. */
  rainSumNext24: number | null;
  /** Max temperature today (°C). */
  tMaxToday: number | null;
  /** Max temperature over the 7-day forecast (°C). */
  tMaxNext7: number | null;
  /** Highest wind (km/h) today or in the forecast. */
  windMax: number | null;
  /** True when none of the next 7 days has meaningful rain. */
  dry7Days: boolean;
  /** Number of dry forecast days (precipProb < 30 and < 1mm). */
  dryDayCount: number | null;
  /** Satellite-derived mean NDVI over the farm polygon. */
  ndviMean: number | null;
  /** Satellite-derived mean NDVI from the previous composite. */
  ndviPrevMean: number | null;
  /** Valid (cloud-free, on-farm) pixels used for the NDVI mean. */
  validPixels: number;
  /** Satellite cloud fraction (%) over the farm, if available. */
  cloudPct: number | null;
  /** First forecast day with meaningful rain probability, if any. */
  firstRainDayIndex: number | null;
  forecast: ForecastDay[];
}

export interface RuleWarning {
  severity: Severity;
  key: string;
  params: Record<string, number | string>;
}

export interface RuleAction {
  key: string;
  params: Record<string, number | string>;
}

export interface AgriOutcome {
  health: {
    status: CropHealthStatus;
    /** i18n key for the short status label. */
    labelKey: string;
  };
  warnings: RuleWarning[];
  /** Farmer actions, at most 3, most important first. */
  actions: RuleAction[];
  /** Focused lines for the small action cards ("Aaj ka mausam", …). */
  cards: {
    weatherToday: { key: string; params: Record<string, number | string> };
    rainWhen: { key: string; params: Record<string, number | string> };
    waterNeed: { key: string; params: Record<string, number | string> };
    cropHealthy: { key: string; params: Record<string, number | string> };
  };
}

const NDVI_MIN_PIXELS = 20;
const NDVI_HEALTHY = 0.5;
const NDVI_WATCH = 0.3;
const NDVI_DECLINE = -0.08;
const NDVI_IMPROVE = 0.08;

export function analyzeAgriculture(input: AgriInput): AgriOutcome {
  const profile = cropProfile(input.crop);

  // --- Satellite-derived crop-health status (always labelled as an estimate
  // --- based on vegetation greenness, never as a diagnosis).
  let status: CropHealthStatus;
  if (
    input.ndviMean === null ||
    input.validPixels < NDVI_MIN_PIXELS
  ) {
    status = "insufficient";
  } else if (input.ndviMean >= NDVI_HEALTHY) {
    status = "healthy";
  } else if (input.ndviMean >= NDVI_WATCH) {
    status = "watch";
  } else {
    status = "stress";
  }

  const warnings: RuleWarning[] = [];
  const actions: RuleAction[] = [];

  // --- Scenario 1: rain expected + crop could get waterlogged. Pure "rain is
  // --- likely" and "wind is strong" warnings come from the weather rules
  // --- engine; here we only ADD crop-specific consequences on top.
  const rainLikely = (input.rainProbNext24 ?? 0) >= 60;
  if (rainLikely && input.rainSumNext24 !== null && input.rainSumNext24 >= 10) {
    warnings.push({
      severity: "warning",
      key: "farm.rule.warn.rainWaterlog",
      params: {
        rain: Math.round(input.rainSumNext24),
        p: Math.round(input.rainProbNext24 ?? 0),
      },
    });
    if (profile.waterlogSensitive) {
      actions.push({ key: "farm.rule.act.drain", params: {} });
    }
  }

  // --- Scenario 2: dry + hot (+ stressed vegetation) -> possible water stress.
  const hot = (input.tMaxToday ?? 0) >= 35 || (input.tMaxNext7 ?? 0) >= 38;
  if (input.dry7Days && hot) {
    const lowGreen = input.ndviMean !== null && input.ndviMean < NDVI_WATCH;
    warnings.push({
      severity: "warning",
      key: "farm.rule.warn.dryHot",
      params: {
        days: input.dryDayCount ?? 7,
        temp: Math.round(Math.max(input.tMaxToday ?? 0, input.tMaxNext7 ?? 0)),
      },
    });
    if (profile.highWaterDemand || lowGreen) {
      actions.push({
        key: "farm.rule.act.waterCheck",
        params: { crop: String(input.crop) },
      });
    }
  }

  // --- Scenario 3: strong wind (+ possible rain) -> spray/damage caution.
  if ((input.windMax ?? 0) >= 30) {
    if (rainLikely) {
      actions.push({ key: "farm.rule.act.noSprayRainWind", params: {} });
    } else {
      actions.push({ key: "farm.rule.act.noSprayWind", params: {} });
    }
  }

  // --- Scenario 4: vegetation declining vs previous observation.
  const trend =
    input.ndviMean !== null && input.ndviPrevMean !== null
      ? input.ndviMean - input.ndviPrevMean
      : null;
  const hasTrend = trend !== null && input.validPixels >= NDVI_MIN_PIXELS;
  if (hasTrend && trend !== null && trend <= NDVI_DECLINE) {
    warnings.push({
      severity: "warning",
      key: "farm.rule.warn.ndviDecline",
      params: {
        delta: Math.abs(Math.round(trend * 100)),
      },
    });
    actions.push({ key: "farm.rule.act.checkReasons", params: {} });
  } else if (hasTrend && trend !== null && trend >= NDVI_IMPROVE) {
    warnings.push({
      severity: "info",
      key: "farm.rule.warn.ndviImprove",
      params: { delta: Math.round(trend * 100) },
    });
  }

  // Deduplicate + cap actions at 3 (most important first).
  const seen = new Set<string>();
  const deduped: RuleAction[] = [];
  for (const a of actions) {
    if (seen.has(a.key)) continue;
    seen.add(a.key);
    deduped.push(a);
    if (deduped.length >= 3) break;
  }
  if (deduped.length === 0) {
    deduped.push({ key: "farm.rule.act.routine", params: {} });
  }

  // --- Small action-card focus lines (each backed by the numbers above).
  const cards = buildCards(input, status, trend);

  return { health: { status, labelKey: `farm.health.${status}` }, warnings, actions: deduped, cards };
}

function buildCards(
  input: AgriInput,
  status: CropHealthStatus,
  trend: number | null
): AgriOutcome["cards"] {
  // Aaj ka mausam
  const tMax = input.tMaxToday ?? input.tMaxNext7 ?? 0;
  const weatherToday: AgriOutcome["cards"]["weatherToday"] = rainLikelyLine(input)
    ? { key: "farm.card.weatherRain", params: { p: Math.round(input.rainProbNext24 ?? 0), t: Math.round(tMax) } }
    : { key: "farm.card.weatherClear", params: { t: Math.round(tMax) } };

  // Baarish kab hogi?
  let rainWhen: AgriOutcome["cards"]["rainWhen"];
  if (input.firstRainDayIndex !== null && input.firstRainDayIndex >= 0) {
    rainWhen = {
      key: "farm.card.rainInDays",
      params: { days: input.firstRainDayIndex + 1 },
    };
  } else if ((input.rainProbNext24 ?? 0) >= 60) {
    rainWhen = { key: "farm.card.rainToday", params: { p: Math.round(input.rainProbNext24 ?? 0) } };
  } else {
    rainWhen = { key: "farm.card.rainNone", params: {} };
  }

  // Paani ki zarurat?
  let waterNeed: AgriOutcome["cards"]["waterNeed"];
  if (rainLikelyLine(input)) {
    waterNeed = { key: "farm.card.waterSkip", params: { p: Math.round(input.rainProbNext24 ?? 0) } };
  } else if (input.dry7Days && (input.tMaxToday ?? 0) >= 35) {
    waterNeed = { key: "farm.card.waterCheck", params: { temp: Math.round(input.tMaxToday ?? 0) } };
  } else if (input.ndviMean !== null && input.ndviMean < NDVI_WATCH && input.validPixels >= NDVI_MIN_PIXELS) {
    waterNeed = { key: "farm.card.waterStress", params: {} };
  } else {
    waterNeed = { key: "farm.card.waterRoutine", params: {} };
  }

  // Fasal healthy hai?
  let cropHealthy: AgriOutcome["cards"]["cropHealthy"];
  if (status === "insufficient") {
    cropHealthy = { key: "farm.card.healthInsufficient", params: {} };
  } else if (status === "healthy") {
    cropHealthy = {
      key:
        trend !== null && trend <= NDVI_DECLINE
          ? "farm.card.healthOkDeclining"
          : "farm.card.healthOk",
      params: {},
    };
  } else if (status === "watch") {
    cropHealthy = { key: "farm.card.healthWatch", params: {} };
  } else {
    cropHealthy = { key: "farm.card.healthStress", params: {} };
  }

  return { weatherToday, rainWhen, waterNeed, cropHealthy };
}

function rainLikelyLine(input: AgriInput): boolean {
  return (input.rainProbNext24 ?? 0) >= 60;
}