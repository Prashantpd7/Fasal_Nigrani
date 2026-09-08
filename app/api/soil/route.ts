import { NextResponse } from "next/server";
import type { Lang } from "@/lib/i18n";
import type { SoilParams } from "@/lib/types";
import { interpretSoil } from "@/lib/server/soilService";

export const runtime = "nodejs";

function sanitizeLang(raw: string | null): Lang {
  return raw === "en" ? "en" : "hi";
}

function num(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

function clamp(v: number | null, lo: number, hi: number): number | null {
  return v === null ? null : Math.min(hi, Math.max(lo, v));
}

/**
 * Soil (मिट्टी जाँच) API — interprets farmer-entered test values (from their
 * Soil Health Card or a field kit) using ICAR/SHC bands, and returns official
 * governmentsoil-testing access points (SHC portal, KVK locator).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = sanitizeLang(searchParams.get("lang"));
  const state = searchParams.get("state") || "Rajasthan";

  const params: SoilParams = {
    ph: clamp(num(searchParams.get("ph")), 0, 14),
    ec: clamp(num(searchParams.get("ec")), 0, 30),
    oc: clamp(num(searchParams.get("oc")), 0, 10),
    n: clamp(num(searchParams.get("n")), 0, 2000),
    p: clamp(num(searchParams.get("p")), 0, 500),
    k: clamp(num(searchParams.get("k")), 0, 1000),
  };

  return NextResponse.json(interpretSoil(lang, params, state));
}