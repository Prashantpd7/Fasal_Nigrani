import type { Severity, SkyGroup } from "./types";

/**
 * Deterministic agricultural-weather rules engine (§7–8, §17).
 *
 * Pure + inspectable by design: given numbers it ALWAYS produces the same
 * structured outcome, with zero LLM calls. An LLM (optional) would only
 * rephrase these already-correct facts — never invent new ones.
 *
 * Literal thresholds from the master brief:
 *   rainProb>=60 (24h)            -> delay irrigation/spray
 *   rainProb>=70 AND rain>=20mm   -> waterlogging warning
 *   tMax>=40°C                    -> heat stress
 *   wind>=30 km/h                 -> no spray / damage risk
 *   7+ dry days & tMax>=35°C      -> dry spell
 *   humidity>=85% & 20–30°C       -> fungal-risk advisory
 *   |delta tMax| day-over-day>=8  -> weather-change caution
 */

export interface WeatherHour {
  time: string;
  temp: number;
  humidity: number;
  precipProb: number;
  precipitation: number;
  windKmh: number;
}

export interface WeatherDay {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
  precipProb: number;
  precipSum: number;
  windMax: number;
}

export interface WeatherInput {
  current: { temp: number; humidity: number; windKmh: number; code: number };
  /** Hourly series covering the next 48h. */
  hourly: WeatherHour[];
  /** 7 days starting today. */
  daily: WeatherDay[];
}

export interface WeatherFacts {
  skyToday: SkyGroup;
  tMin: number;
  tMax: number;
  windTodayKmh: number;
  nowTemp: number;
  nowHumidity: number;
  nowWindKmh: number;
}

/** Warning ids (what the weather is doing). */
export type RuleId =
  | "rainHigh"
  | "waterlog"
  | "heat"
  | "wind"
  | "fungal"
  | "dry"
  | "swing";

/** Action ids (what the farmer should do). */
export type ActionId =
  | "rainNoSpray"
  | "drainCheck"
  | "heatTiming"
  | "windNoSpray"
  | "fungalWatch"
  | "waterSave"
  | "swingWatch"
  | "normalDay";

export interface RuleWarning {
  id: RuleId;
  severity: Severity;
  params: Record<string, number | string>;
}

export interface RuleAction {
  id: ActionId;
}

export interface RulesOutcome {
  facts: WeatherFacts;
  warnings: RuleWarning[];
  actions: RuleAction[];
}

/** WMO weather code -> coarse sky group used for icons/labels. */
export function wmoToGroup(code: number): SkyGroup {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 71 && code <= 77) return "snow";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 80 && code <= 82) return "rain";
  return "cloudy";
}

const round = (n: number) => Math.round(n);

export function analyzeWeather(input: WeatherInput): RulesOutcome {
  const { current, hourly, daily } = input;
  const next24 = hourly.slice(0, 24);

  const facts: WeatherFacts = {
    skyToday: wmoToGroup(daily[0]?.code ?? current.code),
    tMin: daily[0] ? Math.round(daily[0].tMin) : Math.round(current.temp),
    tMax: daily[0] ? Math.round(daily[0].tMax) : Math.round(current.temp),
    windTodayKmh: Math.max(
      round(current.windKmh),
      ...daily.map((d) => round(d.windMax ?? 0))
    ),
    nowTemp: round(current.temp),
    nowHumidity: round(current.humidity),
    nowWindKmh: round(current.windKmh),
  };

  const rainProbNext24 = Math.max(0, ...next24.map((h) => h.precipProb ?? 0));
  const rainSumNext24 = next24.reduce((s, h) => s + (h.precipitation ?? 0), 0);

  const maxTempToday = Math.max(facts.tMax, ...next24.map((h) => round(h.temp)));

  // Dry spell: all 7 forecast days effectively dry AND heat present.
  const dryDays = daily.every(
    (d) => (d.precipProb ?? 0) < 30 && (d.precipSum ?? 0) < 1
  )
    ? daily.length
    : 0;
  const maxTempInDryWeek = Math.max(...daily.map((d) => round(d.tMax)));

  // Fungal window: any hour in next 48h with humidity>=85 and 20–30°C.
  let fungalHumidity: number | null = null;
  for (const h of hourly.slice(0, 48)) {
    if (h.humidity >= 85 && h.temp >= 20 && h.temp <= 30) {
      fungalHumidity = Math.max(fungalHumidity ?? 0, round(h.humidity));
    }
  }

  // Day-over-day max-temp swing (today -> tomorrow).
  const swing =
    daily.length > 1 ? Math.abs(round(daily[0].tMax) - round(daily[1].tMax)) : 0;

  const warnings: RuleWarning[] = [];
  if (rainProbNext24 >= 70 && rainSumNext24 >= 20) {
    warnings.push({
      id: "waterlog",
      severity: "danger",
      params: { rain: round(rainSumNext24) },
    });
  } else if (rainProbNext24 >= 60) {
    warnings.push({
      id: "rainHigh",
      severity: "warning",
      params: { p: round(rainProbNext24) },
    });
  }
  if (maxTempToday >= 40) {
    warnings.push({ id: "heat", severity: "warning", params: { temp: maxTempToday } });
  }
  if (facts.windTodayKmh >= 30) {
    warnings.push({
      id: "wind",
      severity: "warning",
      params: { wind: facts.windTodayKmh },
    });
  }
  if (fungalHumidity !== null) {
    warnings.push({
      id: "fungal",
      severity: "warning",
      params: { humidity: fungalHumidity },
    });
  }
  if (dryDays >= 7 && maxTempInDryWeek >= 35) {
    warnings.push({
      id: "dry",
      severity: "warning",
      params: { days: dryDays, temp: maxTempInDryWeek },
    });
  }
  if (swing >= 8) {
    warnings.push({ id: "swing", severity: "info", params: { delta: swing } });
  }

  // Warnings -> matching actions. Each warning carries its own "why", so the
  // farmer retains agency (§24: instruction + reason, never a bare command).
  const fired = new Set(warnings.map((w) => w.id));
  const pushAction = (list: RuleAction[], id: ActionId) => list.push({ id });

  const actions: RuleAction[] = [];
  if (fired.has("rainHigh") || fired.has("waterlog")) pushAction(actions, "rainNoSpray");
  if (fired.has("waterlog")) pushAction(actions, "drainCheck");
  if (fired.has("heat")) pushAction(actions, "heatTiming");
  if (fired.has("wind")) pushAction(actions, "windNoSpray");
  if (fired.has("fungal")) pushAction(actions, "fungalWatch");
  if (fired.has("dry")) pushAction(actions, "waterSave");
  if (fired.has("swing")) pushAction(actions, "swingWatch");
  if (actions.length === 0) pushAction(actions, "normalDay");

  return { facts, warnings, actions };
}
