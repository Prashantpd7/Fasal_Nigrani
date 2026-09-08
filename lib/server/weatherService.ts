import { tLang } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import {
  analyzeWeather,
  wmoToGroup,
  type WeatherDay,
  type WeatherHour,
  type WeatherInput,
  type RulesOutcome,
} from "@/lib/weatherRules";
import type { WeatherPayload } from "@/lib/types";

/**
 * Open-Meteo — free, no API key (§21). The demo path below produces a full
 * realistic payload through the SAME rules engine as live data, so demo and
 * live behaviour can never diverge.
 */

const OM_URL = "https://api.open-meteo.com/v1/forecast";

export class WeatherFetchError extends Error {}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Fetch current + 48h hourly + 7-day daily forecast from Open-Meteo. */
async function fetchOpenMeteo(
  lat: number,
  lon: number
): Promise<WeatherInput> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    hourly:
      "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
    forecast_hours: "48",
    forecast_days: "7",
    timezone: "auto",
  });

  let res: Response;
  try {
    res = await fetch(`${OM_URL}?${params}`, {
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 0 },
    });
  } catch (e) {
    throw new WeatherFetchError(
      e instanceof Error ? e.message : "open-meteo network error"
    );
  }
  if (!res.ok) {
    throw new WeatherFetchError(`open-meteo HTTP ${res.status}`);
  }
  const j = (await res.json()) as Record<string, unknown>;
  const cur = (j.current ?? {}) as Record<string, unknown>;
  const hourly = (j.hourly ?? {}) as Record<string, unknown[]>;
  const daily = (j.daily ?? {}) as Record<string, unknown[]>;

  const times = (hourly.time ?? []) as string[];
  const hours: WeatherHour[] = times.map((time, i) => ({
    time,
    temp: asNumber(hourly.temperature_2m?.[i]),
    humidity: asNumber(hourly.relative_humidity_2m?.[i]),
    precipProb: asNumber(hourly.precipitation_probability?.[i]),
    precipitation: asNumber(hourly.precipitation?.[i]),
    windKmh: asNumber(hourly.wind_speed_10m?.[i]),
  }));

  const dtimes = (daily.time ?? []) as string[];
  const days: WeatherDay[] = dtimes.map((date, i) => ({
    date,
    code: Math.round(asNumber(daily.weather_code?.[i])),
    tMax: asNumber(daily.temperature_2m_max?.[i]),
    tMin: asNumber(daily.temperature_2m_min?.[i]),
    precipProb: asNumber(daily.precipitation_probability_max?.[i]),
    precipSum: asNumber(daily.precipitation_sum?.[i]),
    windMax: asNumber(daily.wind_speed_10m_max?.[i]),
  }));

  return {
    current: {
      temp: asNumber(cur.temperature_2m),
      humidity: asNumber(cur.relative_humidity_2m),
      windKmh: asNumber(cur.wind_speed_10m),
      code: Math.round(asNumber(cur.weather_code)),
    },
    hourly: hours,
    daily: days,
  };
}

function localizeOutcome(
  outcome: RulesOutcome,
  lang: Lang,
  locationName: string,
  source: WeatherPayload["source"],
  days: WeatherDay[]
): WeatherPayload {
  const { facts, warnings, actions } = outcome;
  const sky = tLang(lang, `weather.code.${facts.skyToday}`);
  const summary = tLang(lang, "weather.summaryToday", {
    tMin: facts.tMin,
    tMax: facts.tMax,
    wind: facts.windTodayKmh,
    sky,
  });
  const nowLine = tLang(lang, "weather.nowLine", {
    temp: facts.nowTemp,
    humidity: facts.nowHumidity,
    wind: facts.nowWindKmh,
  });

  return {
    locationName,
    source,
    fetchedAt: Date.now(),
    current: {
      temp: facts.nowTemp,
      humidity: facts.nowHumidity,
      windKmh: facts.nowWindKmh,
      group: facts.skyToday,
    },
    today: { tMin: facts.tMin, tMax: facts.tMax },
    summary,
    nowLine,
    warnings: warnings.map((w) => ({
      severity: w.severity,
      message: tLang(lang, `weather.rule.warn.${w.id}`, w.params),
    })),
    actions: actions.map((a) => tLang(lang, `weather.rule.act.${a.id}`)),
    forecast: days.map((d) => ({
      date: d.date,
      group: wmoToGroup(d.code),
      tMax: Math.round(d.tMax),
      tMin: Math.round(d.tMin),
      precipProb: Math.round(d.precipProb),
      precipSum: Math.round(d.precipSum),
    })),
  };
}

/** Primary live path. Throws WeatherFetchError when Open-Meteo is down. */
export async function getWeather(
  lat: number,
  lon: number,
  lang: Lang,
  locationName: string
): Promise<WeatherPayload> {
  const input = await fetchOpenMeteo(lat, lon);
  const outcome = analyzeWeather(input);
  return localizeOutcome(outcome, lang, locationName, "live", input.daily);
}

// ---------------------------------------------------------------------------
// Demo mode (§34): deterministic, reproducible sample data for the chosen
// place. Same shape, same engine — guaranteed demo without live network.
// ---------------------------------------------------------------------------

function dayNumber(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

/** Pick a scenario per place + day so the demo is stable across reloads. */
function demoScenario(placeKey: string, date: Date): number {
  const seed =
    dayNumber(date) + placeKey.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return ((seed % 4) + 4) % 4;
}

const sine = (i: number, min: number, max: number) =>
  min + ((max - min) * (0.5 + 0.5 * Math.sin((i / 24) * Math.PI * 2 - 1.3)));

function buildDemoInput(
  placeKey: string,
  now: Date
): { input: WeatherInput; days: WeatherDay[] } {
  const scenario = demoScenario(placeKey, now);
  const startHour = new Date(now);
  startHour.setMinutes(0, 0, 0);
  startHour.setHours(startHour.getHours() + 1);

  const dayAt = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const iso = (offsetH: number) => {
    const d = new Date(startHour);
    d.setHours(d.getHours() + offsetH);
    return d.toISOString().slice(0, 13) + ":00";
  };

  const dayCodes: number[] = [];
  const tMaxes: number[] = [];
  const tMins: number[] = [];
  const dayProb: number[] = [];
  const dayRain: number[] = [];
  const dayWind: number[] = [];
  const hourly: WeatherHour[] = [];

  const pushDaily = (
    offset: number,
    code: number,
    tMax: number,
    tMin: number,
    prob: number,
    rain: number,
    wind: number
  ) => {
    dayCodes.push(code);
    tMaxes.push(tMax);
    tMins.push(tMin);
    dayProb.push(prob);
    dayRain.push(rain);
    dayWind.push(wind);
  };

  if (scenario === 0) {
    // Warm, mostly clear, calm — "routine" demo day.
    for (let i = 0; i < 7; i++) {
      const codes = [0, 1, 2, 0, 1, 2, 0];
      pushDaily(i, codes[i], 36 + (i % 3), 24, 10, 0, 14);
    }
  } else if (scenario === 1) {
    // Heavy rain today: waterlogging risk demo.
    pushDaily(0, 61, 31, 25, 96, 26, 20);
    for (let i = 1; i < 7; i++) {
      const codes = [2, 1, 0, 0, 1, 2];
      pushDaily(i, codes[i - 1], 33 + (i % 2), 24, 12, 0, 15);
    }
  } else if (scenario === 2) {
    // Extreme heat + strong wind: two simultaneous warnings.
    pushDaily(0, 0, 44, 28, 5, 0, 34);
    for (let i = 1; i < 7; i++) {
      const codes = [0, 1, 0, 0, 1, 2];
      pushDaily(i, codes[i - 1], 41 + (i % 2), 27, 8, 0, 24);
    }
  } else {
    // Humid, overcast today turning hot tomorrow: fungal + swing.
    pushDaily(0, 3, 29, 25, 40, 2, 12);
    pushDaily(1, 0, 38, 26, 5, 0, 12);
    for (let i = 2; i < 7; i++) {
      const codes = [0, 1, 2, 0, 1];
      pushDaily(i, codes[i - 2], 36 + (i % 2), 24, 8, 0, 14);
    }
  }

  // Rebuild hourly series consistently from the chosen per-day shape.
  for (let h = 0; h < 48; h++) {
    const dayIdx = Math.min(6, Math.floor(h / 24));
    const tMin = tMins[dayIdx];
    const tMax = tMaxes[dayIdx];
    const raining = scenario === 1 && dayIdx === 0 && h < 8;
    const hotWindy = scenario === 2 && dayIdx === 0;
    const humidCool = scenario === 3 && dayIdx === 0;

    const baseTemp = sine(h % 24, tMin, tMax);
    const humidity = raining
      ? 90 - (h % 4)
      : humidCool
        ? 91 - (h % 5)
        : hotWindy
          ? 26 + (h % 4)
          : 42 + ((h % 12) / 12) * 22;
    const wind = hotWindy ? 30 + (h % 5) : Math.max(6, dayWind[dayIdx] - (h % 5));
    const prob = raining ? 95 - (h % 4) : dayProb[dayIdx];
    const rain =
      raining && h % 3 === 0 ? 4 : raining ? 1.6 : dayIdx === 0 && dayRain[0] > 0 && h % 6 === 0 ? 1.4 : 0;

    hourly.push({
      time: iso(h),
      temp: Math.round(baseTemp),
      humidity: Math.round(Math.min(99, humidity)),
      precipProb: Math.round(prob),
      precipitation: rain,
      windKmh: Math.round(wind),
    });
  }

  const hours = 48;
  const demoHourly = hourly.slice(0, hours);

  const days: WeatherDay[] = Array.from({ length: 7 }, (_, i) => ({
    date: dayAt(i),
    code: dayCodes[i],
    tMax: tMaxes[i],
    tMin: tMins[i],
    precipProb: dayProb[i],
    precipSum: dayRain[i],
    windMax: dayWind[i],
  }));

  const current = demoHourly[0];
  const input: WeatherInput = {
    current: {
      temp: current.temp,
      humidity: current.humidity,
      windKmh: current.windKmh,
      code: dayCodes[0],
    },
    hourly: demoHourly,
    daily: days,
  };
  return { input, days };
}

/** Demo-mode weather — never fails, always demo-shaped (§34). */
export function getDemoWeather(
  placeKey: string,
  lang: Lang,
  locationName: string
): WeatherPayload {
  const { input, days } = buildDemoInput(placeKey, new Date());
  const outcome = analyzeWeather(input);
  return localizeOutcome(outcome, lang, locationName, "demo", days);
}
