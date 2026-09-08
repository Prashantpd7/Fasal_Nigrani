import { NextResponse } from "next/server";
import { getSchemes } from "@/lib/server/schemesService";

export const runtime = "nodejs";

/**
 * Government schemes API — returns the verified official registry
 * (categories + schemes with official portal links and last-verified date).
 */
export async function GET() {
  return NextResponse.json(getSchemes());
}