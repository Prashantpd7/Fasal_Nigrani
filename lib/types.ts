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
  /** Max wind in km/h (Open-Meteo daily wind_speed_10m_max). */
  windMax?: number | null;
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
    /** Feels-like temperature (°C). */
    apparentTemp?: number | null;
    /** Cloud cover 0–100 %. */
    cloudCover?: number | null;
    /** Wind direction in degrees (0=N, 90=E…). */
    windDir?: number | null;
    /** Current precipitation (mm). */
    precip?: number | null;
    /** Rain probability for the next hour (%). */
    rainProb?: number | null;
  };
  today: { tMin: number; tMax: number };
  /** Next 24h from the hourly forecast (used by the agri rules engine). */
  next24: { rainProbMax: number; rainSum: number };
  summary: string;
  nowLine: string;
  warnings: WeatherWarning[];
  actions: string[];
  forecast: ForecastDay[];
}

// ---------------------------------------------------------------------------
// Farm dashboard (§ Farm) — location + polygon + crop + satellite monitoring.
// ---------------------------------------------------------------------------

export interface FarmPolygon {
  /** [lat, lon] ordered ring (>=3 points, closed implicitly). */
  ring: [number, number][];
  /** Approximate area in square metres (shoelace on Web-Mercator plane). */
  areaM2: number | null;
}

export type CropId =
  | "wheat"
  | "mustard"
  | "bajra"
  | "maize"
  | "cotton"
  | "chickpea"
  | "cumin"
  | "other";

export interface FarmState {
  /** Stable cache key (place id or custom coords). */
  key: string;
  /** Localized display name, e.g. "Barmer, Rajasthan". */
  label: string;
  lat: number;
  lon: number;
  polygon: FarmPolygon | null;
  crop: CropId | null;
  cropLabel: string | null;
}

export type CropHealthStatus =
  | "healthy"
  | "watch"
  | "stress"
  | "insufficient";

/** Satellite provider layer info — everything the client needs to fetch tiles. */
export interface SatelliteLayer {
  source: "nasa-gibs";
  product: string;
  /** Observation date of the latest available composite (yyyy-mm-dd). */
  date: string;
  /** ISO date of the previous composite (for trend comparison). */
  prevDate: string | null;
  /** Composite length in days (e.g. 8 for VIIRS 8-day NDVI). */
  periodDays: number;
  daysAgo: number;
  /** WMTS tile URL template with {date},{z},{y},{x} placeholders. */
  tileUrl: string;
  /** GIBS colormap URL used to decode pixel colours to values. */
  colormapUrl: string;
  maxZoom: number;
  minZoom: number;
  /** Human title of the layer, e.g. "Vegetation index (NDVI)". */
  title: string;
}

export interface SatelliteStatus {
  ok: boolean;
  /** Honest provider availability. */
  ndvi: SatelliteLayer | null;
  cloud: SatelliteLayer | null;
  /** Basemap (satellite imagery) config. */
  basemap: {
    source: "esri-world-imagery";
    tileUrl: string;
    attribution: string;
    maxZoom: number;
  };
  /** Optional higher-resolution path (needs credentials — usually not connected). */
  copernicus: {
    connected: boolean;
    source: "copernicus-sentinel-2";
    note: string | null;
  };
  fetchedAt: number;
}

/** Measured satellite stats for a farm polygon — real, never estimated. */
export interface SatelliteStats {
  ndviMean: number | null;
  ndviPrevMean: number | null;
  /** ndviMean - ndviPrevMean (positive = greener than previous observation). */
  ndviDelta: number | null;
  validPixels: number;
  cloudPct: number | null;
  obsDate: string | null;
  prevObsDate: string | null;
  /** true when the measurement could not be made (network / no data). */
  unavailable: boolean;
  error: string | null;
}

export interface GeoPlace {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

// ---------------------------------------------------------------------------
// AgroMonitoring (OpenWeather agro API) — farm-level monitoring (§ Farm).
// Real values only; the API key stays server-side. All dates are real
// observation timestamps, never claimed to be "live".
// ---------------------------------------------------------------------------

/** Latest NDVI observation for the farm polygon (real API value). */
export interface AgroNdviObs {
  /** Observation time (unix s, UTC). */
  dt: number;
  /** Satellite source: "l8" (Landsat 8) or "s2" (Sentinel-2). */
  source: string;
  /** % of the polygon with valid data. */
  coveragePct: number | null;
  /** % cloud coverage. */
  cloudPct: number | null;
  /** Mean vegetation index across the polygon. */
  mean: number | null;
  /** Median vegetation index across the polygon. */
  median: number | null;
  min: number | null;
  max: number | null;
}

/** Newest satellite imagery entry (true color) for the polygon. */
export interface AgroImagery {
  /** Acquisition time (unix s, UTC). */
  dt: number;
  satellite: string;
  coveragePct: number | null;
  cloudPct: number | null;
}

/** Soil temperature + moisture estimate (model estimate, not a probe). */
export interface AgroSoil {
  /** Time of calculation (unix s, UTC). */
  dt: number;
  /** Surface temperature, Kelvins. */
  t0K: number | null;
  /** Temperature at 10 cm depth, Kelvins. */
  t10K: number | null;
  /** Soil moisture, m3/m3 — model estimate. */
  moistureM3: number | null;
}

/** Full AgroMonitoring dashboard payload — always honest about availability. */
export interface AgroMonitoringData {
  ok: boolean;
  configured: boolean;
  /** AgroMonitoring polygon id (registered from the drawn field). */
  polyId: string | null;
  ndviLatest: AgroNdviObs | null;
  ndviPrev: AgroNdviObs | null;
  imagery: AgroImagery | null;
  soil: AgroSoil | null;
  fetchedAt: number;
  /** Developer-facing error kind, e.g. "not_configured" (never shown raw). */
  error: string | null;
  errorMessage: string | null;
}

/** Result of registering the drawn field with AgroMonitoring. */
export interface AgroRegisterResult {
  ok: boolean;
  configured: boolean;
  polyId: string | null;
  areaHa: number | null;
  center: [number, number] | null;
  error?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Crop photo analysis — the REAL pipeline (Gemini vision -> ICAR/KVK knowledge
// verification -> confidence -> safe result). No demo data ever reaches here.
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

export type HealthStatus = "healthy" | "stress" | "unhealthy" | "unclear";

export type VerificationLevel = "verified" | "likely" | "uncertain";

export type ConditionType =
  | "disease"
  | "pest"
  | "nutrient"
  | "stress"
  | "other";

export interface SuspectedCondition {
  name: string;
  type: ConditionType;
  /** 2-3 simple observations from the image supporting this. */
  symptoms_observed: string[];
  confidence_pct: number | null;
}

/** A condition matched against the trusted agricultural knowledge base. */
export interface KnowledgeMatch {
  conditionId: string;
  /** Localized condition name from the knowledge base. */
  conditionName: string;
  crop: string;
  type: ConditionType;
  level: VerificationLevel;
  /** Simple symptoms listed by the knowledge base (localized). */
  symptoms: string[];
  /** Safe, sourced management steps (localized) — never invented by the LLM. */
  management: string[];
  warning: string | null;
  /** Trusted source, e.g. "ICAR crop advisory / KVK". */
  source: string;
}

export interface AnalysisResult {
  image_quality_ok: boolean;
  quality_issue:
    | "too_blurry"
    | "too_dark"
    | "subject_too_far"
    | "not_a_plant"
    | null;
  /** Detected crop, e.g. "wheat"; null when not detectable. */
  crop: string | null;
  /** Localized display name of the detected crop. */
  cropLabel: string | null;
  health: HealthStatus;
  /** Localized label of the most likely problem (or null). */
  likely_problem: string | null;
  /** Final confidence 0-100 after knowledge verification. */
  confidence_pct: number;
  confidence: Confidence;
  /** 2-3 simple observations from the image (localized by the model). */
  why: string[];
  /** Safe recommended actions (3-5 steps), from the knowledge base. */
  recommended_action: string[];
  warning: string | null;
  /** Trusted source of the recommendation, e.g. "ICAR advisory". */
  source: string;
  verification: VerificationLevel;
  /** Honest note when the condition could not be reliably verified. */
  verification_note: string | null;
  /** Additional photo types the model asks for (close-up leaf, stem…). */
  ask_more_photos: string[];
  needs_expert: boolean;
  /** Product label detected in the image (e.g. a pesticide packet). */
  product_mentioned: { name: string; kind: string } | null;
  /** Verified knowledge matches (may be empty when nothing matched). */
  knowledge: KnowledgeMatch[];
  /** One-line summary, used by the chatbot as context. */
  explanation_simple: string;
  /** Plant.id is only ever an additional signal, never truth. */
  plantId: {
    used: boolean;
    isHealthy: boolean | null;
    topName: string | null;
    topProbability: number | null;
    agreement: "agree" | "disagree" | null;
  } | null;
  images_analyzed: number;
  /** True when a model key (Gemini/Anthropic/OpenAI) is configured. */
  configured: boolean;
  // Backwards-compatible aliases used by older UI/chat code.
  likely_category: Category;
  possible_specific_issue: string | null;
  seek_expert_advice: boolean;
  better_photo_tip: string | null;
  what_to_do_now: string[];
  what_to_avoid: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Context the chat can use: weather + the latest crop analysis. */
export interface ChatRequestContext {
  weather?: { locationName: string; summary: string } | null;
  photo?: {
    summary: string;
    crop: string | null;
    problem: string | null;
    confidencePct: number | null;
    source: string | null;
  } | null;
}

export interface ChatReply {
  message: string;
  demo: boolean;
}

// ===========================================================================
// v2 — Market prices (Agmarknet, Ministry of Agriculture & FW, Govt of India)
// ===========================================================================

/** One market's price record for a commodity on one day. */
export interface MarketDayEntry {
  /** Modal (most common) price — Rs./Quintal. */
  modal: number | null;
  min: number | null;
  max: number | null;
  /** Arrivals in metric tonnes. */
  arrivalsMt: number | null;
}

/** Per-market snapshot: latest prices + a short trend + best activity date. */
export interface MarketMandi {
  /** Market name as reported by Agmarknet, e.g. "Kota APMC". */
  name: string;
  /** Latest reported date (dd/mm/yyyy). */
  latestDate: string;
  latest: MarketDayEntry;
  previous: MarketDayEntry | null;
  /** Up to 8 most-recent modal prices (null = no report that day). */
  trend: (number | null)[];
  /** Total arrivals across the latest reported week, metric tonnes. */
  weekArrivalsMt: number | null;
  /** Days with a reported price in the latest week. */
  daysReported: number;
}

export interface MarketPayload {
  source: "live" | "demo";
  fetchedAt: number;
  /** Period the data covers, e.g. "09/2026". */
  month: string;
  commodityName: string;
  stateName: string;
  mandis: MarketMandi[];
  /** True when the government API is reachable but has no data for this pick. */
  empty: boolean;
  message: string | null;
}

// ===========================================================================
// v2 — Soil testing (ICAR interpretation + government labs / SHC portal)
// ===========================================================================

export type SoilParams = {
  /** pH value. */
  ph: number | null;
  /** Electrical conductivity, dS/m. */
  ec: number | null;
  /** Organic carbon, %. */
  oc: number | null;
  /** Nitrogen, kg/ha. */
  n: number | null;
  /** Phosphorus (P2O5), kg/ha. */
  p: number | null;
  /** Potassium (K2O), kg/ha. */
  k: number | null;
};

export interface SoilBand {
  range: string;
  labelKey: string;
  noteKey: string;
}

export interface SoilFactorResult {
  param: string;
  /** Inline unit shown next to the entered value. */
  unit: string;
  value: number | null;
  band: "low" | "medium" | "high" | "neutral" | "acidic" | "alkaline" | "saline" | null;
  /** Localized band label. */
  label: string;
  /** Localized plain-language note. */
  note: string;
  treat: string[] | null;
}

export interface SoilInterpretation {
  factors: SoilFactorResult[];
  /** Localized overall verdict sentence. */
  summary: string;
  /** Localized suggestions list. */
  suggestions: string[];
  healthyBand: boolean;
}

export interface SoilLab {
  name: string;
  district: string;
  state: string;
  /** Official helpline / contact shown as text (no phone scraping). */
  contact: string;
  /** Official portal URL. */
  url: string;
}

export interface SoilPayload {
  source: "live" | "demo";
  fetchedAt: number;
  stateName: string;
  districtName: string | null;
  /** Interpretation of the farmer-entered test values. */
  result: SoilInterpretation;
  /** Government soil-testing labs near the selected district. */
  labs: SoilLab[];
  /** Soil Health Card official portal URL. */
  shcUrl: string;
  note: string;
}

// ===========================================================================
// v2 — Government schemes (curated official registry)
// ===========================================================================

export type SchemeCategory =
  | "financial"
  | "insurance"
  | "irrigation"
  | "soil"
  | "machinery"
  | "solar"
  | "horticulture"
  | "market"
  | "skill";

export interface GovtScheme {
  id: string;
  nameEn: string;
  nameHi: string;
  category: SchemeCategory;
  /** Central or a specific state (null/"" = all-India central). */
  states: string[];
  ministry: string;
  benefit: string;
  eligibility: string;
  applyUrl: string | null;
  portalUrl: string;
  lastUpdated: string;
  active: boolean;
}

export interface SchemesPayload {
  source: "live" | "curated";
  fetchedAt: number;
  updatedNote: string;
  categories: SchemeCategory[];
  schemes: GovtScheme[];
}

// ===========================================================================
// v2 — shared small types
// ===========================================================================

export type GovSource = "agmarknet" | "data-gov" | "ic001";

export interface ApiError {
  error: string;
  message: string;
  label?: string;
}
