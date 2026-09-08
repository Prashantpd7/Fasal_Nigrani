import { NextResponse } from "next/server";
import { fetchStates } from "@/lib/server/agmarknetService";
import { AgmarknetError } from "@/lib/server/agmarknetService";

export const runtime = "nodejs";

/** States/UTs as known to the Agmarknet portal (live taxonomy). */
export async function GET() {
  try {
    const states = await fetchStates();
    return NextResponse.json({ source: "live", states });
  } catch (e) {
    if (e instanceof AgmarknetError) {
      return NextResponse.json(
        { source: "demo", states: [{ id: 29, name: "Rajasthan" }] },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: "server", message: "states service error" },
      { status: 502 }
    );
  }
}