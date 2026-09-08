// Shared types between the client pages, the /api routes and lib/server.

export type Severity = "info" | "warning" | "danger";

export type SkyGroup =
  | "clear"
  | "partly"
  | "cloudy"
  | "rain"
  | "storm"
  | "snow"
  | "fog";

export interface WeatherWarning {
  severity: Severity;
  message: string;
}

export interface ForecastDay {
  /** ISO date (yyyy-mm-dd, local to the location). */
  date: string;
  group: SkyGroup;
  tMax: number;
  tMin: number;
  precipProb: number | null;
  precipSum: number | null;
}

export interface WeatherPayload {
  locationName: string;
  /** "live" = fetched from Open-Meteo; "demo" = DEMO_MODE sample data. */
  source: "live" | "demo";
  fetchedAt: number;
  current: {
    temp: number;
    humidity: number;
    windKmh: number;
    group: SkyGroup;
  };
  today: { tMin: number; tMax: number };
  summary: string;
  nowLine: string;
  warnings: WeatherWarning[];
  actions: string[];
  forecast: ForecastDay[];
}

export interface GeoPlace {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

// ---------------------------------------------------------------------------
// Photo analysis — mirrors the strict vision JSON contract (§8) exactly.
// ---------------------------------------------------------------------------
export type Confidence = "low" | "medium" | "high";

export type Category =
  | "disease"
  | "pest_damage"
  | "water_stress"
  | "nutrient_deficiency"
  | "physical_damage"
  | "unclear"
  | "looks_healthy";

export interface AnalysisResult {
  image_quality_ok: boolean;
  quality_issue:
    | "too_blurry"
    | "too_dark"
    | "subject_too_far"
    | "not_a_plant"
    | null;
  likely_category: Category;
  /** Free text, already in the farmer's selected language. */
  possible_specific_issue: string | null;
  confidence: Confidence;
  explanation_simple: string;
  what_to_do_now: string[];
  what_to_avoid: string[];
  seek_expert_advice: boolean;
  better_photo_tip: string | null;
  /** true when the reply came from demo data instead of a vision model. */
  demo?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestContext {
  weather?: { locationName: string; summary: string } | null;
  photo?: { summary: string } | null;
}

export interface ChatReply {
  message: string;
  demo: boolean;
}
