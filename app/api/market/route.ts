import { NextResponse } from "next/server";
import type { Lang } from "@/lib/i18n";
import { POPULAR_COMMODITIES } from "@/lib/marketCatalog";
import type { MarketPayload } from "@/lib/types";
import {
  AgmarknetError,
  fetchMarketPrices,
  resolveCommodity,
} from "@/lib/server/agmarknetService";

export const runtime = "nodejs";

function sanitizeLang(raw: string | null): Lang {
  return raw === "en" ? "en" : "hi";
}

/**
 * Market (मंडी भाव) API — live prices from Agmarknet (Ministry of Agriculture
 * & Farmers Welfare, Govt of India). It never substitutes generated prices
 * when the official service is unavailable.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = sanitizeLang(searchParams.get("lang"));
  const stateParam = Number(searchParams.get("stateId"));
  const crop = searchParams.get("crop") || "wheat";

  const catalogRec = POPULAR_COMMODITIES.find((c) => c.id === crop);
  if (!catalogRec) {
    return NextResponse.json(
      { error: "unknown_crop", message: "crop not in market catalog" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(stateParam) || stateParam <= 0) {
    return NextResponse.json(
      { error: "invalid_state", message: "stateId required" },
      { status: 400 }
    );
  }

  try {
    const resolved = await resolveCommodity(catalogRec.agmarknetName);
    if (!resolved) {
      return NextResponse.json(
        { error: "unavailable", message: "commodity unavailable on agmarknet" },
        { status: 404 }
      );
    }
    const data = await fetchMarketPrices(stateParam, resolved.agmarknetId);
    const payload: MarketPayload = {
      source: "live",
      fetchedAt: Date.now(),
      month: data.month,
      commodityName: lang === "hi" ? catalogRec.hi : data.commodityName,
      stateName: data.stateName,
      mandis: data.mandis,
      empty: data.mandis.length === 0,
      message: data.mandis.length === 0 ? "no_report" : null,
    };
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof AgmarknetError) {
      return NextResponse.json(
        { error: "unavailable", message: "Agmarknet is temporarily unavailable" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "server", message: "market service error" },
      { status: 502 }
    );
  }
}