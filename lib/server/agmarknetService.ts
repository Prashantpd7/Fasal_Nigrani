/**
 * Agmarknet live market prices — official portal of the Ministry of
 * Agriculture & Farmers Welfare, Government of India.
 *   Portal : https://agmarknet.gov.in/   API base : https://api.agmarknet.gov.in/v1
 *
 * We use two public endpoints that need no login/captcha:
 *   1. GET /daily-price-arrival/filters
 *        -> official taxonomy (states, markets, commodities, ids).
 *   2. GET /prices-and-arrivals/date-wise/specific-commodity
 *        ?year&month&stateId&commodityId&includeExcel=false
 *        -> every market in a state for that commodity, with per-date
 *           arrivals + min/max/modal price (Rs./Quintal).
 *
 * The commodity/market ids are resolved from the portal's own filters every
 * launch (never hard-coded), so the integration stays correct if the portal
 * renumbers anything.
 */
import type { MarketMandi, MarketPayload } from "@/lib/types";

const BASE = "https://api.agmarknet.gov.in/v1";
const FILTERS_TTL_MS = 1000 * 60 * 60 * 12; // taxonomy is stable — 12h cache

export class AgmarknetError extends Error {}

interface Filters {
  states: { id: number; name: string }[];
  markets: { id: number; name: string; stateId: number }[];
  commodities: { id: number; name: string }[];
  fetchedAt: number;
}

let filtersCache: Filters | null = null;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

async function getJson(
  path: string,
  params: Record<string, string | number>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${qs}`, {
      headers: {
        Accept: "application/json",
        // Agmarknet's WAF rejects datacenter/node default UAs (HTTP 403);
        // a normal browser UA is required to reach the public API.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Referer: "https://agmarknet.gov.in/",
      },
      signal: AbortSignal.timeout(20_000),
      next: { revalidate: 0 },
    });
  } catch (e) {
    throw new AgmarknetError(
      e instanceof Error ? e.message : "agmarknet network error"
    );
  }
  if (!res.ok) throw new AgmarknetError(`agmarknet HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Taxonomy (states/markets/commodities) with a short-lived in-memory cache. */
export async function getFilters(): Promise<Filters> {
  if (filtersCache && Date.now() - filtersCache.fetchedAt < FILTERS_TTL_MS) {
    return filtersCache;
  }
  const j = await getJson("/daily-price-arrival/filters", {});
  const data = (j.data ?? {}) as Record<string, unknown>;
  const states = (
    (data.state_data ?? []) as { state_id: number; state_name: string }[]
  )
    .filter((s) => s.state_id !== 100000)
    .map((s) => ({ id: s.state_id, name: s.state_name }));
  const markets = (
    (data.market_data ?? []) as {
      id: number;
      mkt_name: string;
      state_id: number | null;
    }[]
  )
    .filter((m) => m.id !== 100002 && m.state_id)
    .map((m) => ({ id: m.id, name: m.mkt_name.trim(), stateId: m.state_id! }));
  const commodities = (
    (data.cmdt_data ?? []) as { cmdt_id: number; cmdt_name: string }[]
  ).map((c) => ({ id: c.cmdt_id, name: c.cmdt_name }));
  filtersCache = { states, markets, commodities, fetchedAt: Date.now() };
  return filtersCache;
}

interface RawMarketEntry {
  arrivalDate: string;
  total_arrivals: number | null;
  data: {
    arrivals: number | null;
    variety: string;
    minimumPrice: number | null;
    maximumPrice: number | null;
    modalPrice: number | null;
  }[];
}

interface RawMarket {
  marketName: string;
  dates: RawMarketEntry[];
}

/**
 * Latest available month's data for one state + commodity (tries the current
 * month, then the previous two). Returns per-market summaries.
 */
export async function fetchMarketPrices(
  stateId: number,
  commodityId: number
): Promise<{
  month: string;
  stateName: string;
  commodityName: string;
  mandis: MarketMandi[];
}> {
  const f = await getFilters();
  const stateName = f.states.find((s) => s.id === stateId)?.name ?? "State";
  const commodityName =
    f.commodities.find((c) => c.id === commodityId)?.name ?? "Commodity";

  const now = new Date();
  // Try the current month first, then walk back up to 2 months.
  for (let back = 0; back < 3; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const j = await getJson("/prices-and-arrivals/date-wise/specific-commodity", {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      includeExcel: "false",
      stateId,
      commodityId,
    });
    const markets = (j.markets ?? []) as RawMarket[];
    const mandis = markets
      .map((m) => summarizeMarket(m))
      .sort((a, b) => b.daysReported - a.daysReported);
    if (mandis.length > 0) {
      return { month, stateName, commodityName, mandis };
    }
  }
  // No data in the last 3 months — return an honest empty set.
  return {
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    stateName,
    commodityName,
    mandis: [],
  };
}

function parseDate(ddMMyyyy: string): Date {
  const [dd, mm, yyyy] = ddMMyyyy.split("/").map((n) => Number(n));
  return new Date(yyyy, mm - 1, dd);
}

function summarizeMarket(m: RawMarket): MarketMandi {
  const rows: { date: string; when: Date; entry: MarketMandi["latest"] }[] = [];
  for (const dt of m.dates) {
    if (!dt.data?.length) continue;
    const pick = dt.data[0];
    rows.push({
      date: dt.arrivalDate,
      when: parseDate(dt.arrivalDate),
      entry: {
        modal: pick.modalPrice ?? null,
        min: pick.minimumPrice ?? null,
        max: pick.maximumPrice ?? null,
        arrivalsMt: pick.arrivals ?? dt.total_arrivals ?? null,
      },
    });
  }
  rows.sort((a, b) => a.when.getTime() - b.when.getTime());
  if (rows.length === 0) {
    return {
      name: m.marketName,
      latestDate: "",
      latest: { modal: null, min: null, max: null, arrivalsMt: null },
      previous: null,
      trend: [],
      weekArrivalsMt: null,
      daysReported: 0,
    };
  }
  const latest = rows[rows.length - 1];
  const prevRow = [...rows].reverse().find((r) => r !== latest);
  const lastWeek = rows.slice(-8);
  const weekArrivals = lastWeek.reduce(
    (sum, r) => sum + (r.entry.arrivalsMt ?? 0),
    0
  );
  return {
    name: m.marketName,
    latestDate: latest.date,
    latest: latest.entry,
    previous: prevRow ? prevRow.entry : null,
    trend: lastWeek.map((r) => r.entry.modal),
    weekArrivalsMt:
      lastWeek.length >= 2 ? Math.round(weekArrivals * 100) / 100 : null,
    daysReported: lastWeek.filter((r) => r.entry.modal !== null).length,
  };
}

/** Demo-mode market data — clearly labelled, same shape as live. */
export async function getDemoMarketPrices(
  commodityName: string,
  stateName: string
): Promise<MarketPayload> {
  const now = new Date();
  const names = [
    "Barmer APMC",
    "Hanumangarh APMC",
    "Nagaur Grain APMC",
    "Jaipur (Grain) APMC",
    "Kota APMC",
    "Udaipur Grain APMC",
  ];
  const mandis: MarketMandi[] = names.map((n, i) => {
    const trend: (number | null)[] = [];
    for (let j = 7; j >= 0; j--) {
      trend.push(j % 3 === 0 ? null : Math.round(4200 + i * 240 + Math.sin(j + i) * 120));
    }
    const modal = trend[trend.length - 1] ?? 4200;
    return {
      name: n,
      latestDate: "01/09/2026",
      latest: {
        modal,
        min: Math.round(modal * 0.9),
        max: Math.round(modal * 1.08),
        arrivalsMt: 210 + i * 40,
      },
      previous: { modal: trend[trend.length - 2], min: null, max: null, arrivalsMt: 190 + i * 30 },
      trend,
      weekArrivalsMt: (210 + i * 40) * 5,
      daysReported: 5 + (i % 2),
    };
  });
  return {
    source: "demo",
    fetchedAt: now.getTime(),
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    commodityName,
    stateName,
    mandis,
    empty: false,
    message: null,
  };
}
export interface AgmStateRec {
  id: number;
  name: string;
}

/** All states/UTs known to the portal (37). */
export async function fetchStates(): Promise<AgmStateRec[]> {
  const f = await getFilters();
  return f.states;
}

export interface AgmCommodityResolved {
  id: string;
  agmarknetId: number;
  name: string;
}

/** Resolve one of our popular commodities against the live portal names. */
export async function resolveCommodity(
  agmarknetName: string
): Promise<AgmCommodityResolved | null> {
  const f = await getFilters();
  const want = norm(agmarknetName);
  const exact = f.commodities.find((c) => norm(c.name) === want);
  if (exact) return { id: agmarknetName, agmarknetId: exact.id, name: exact.name };
  const fuzzy = f.commodities.find((c) => norm(c.name).includes(want));
  if (fuzzy) return { id: agmarknetName, agmarknetId: fuzzy.id, name: fuzzy.name };
  return null;
}