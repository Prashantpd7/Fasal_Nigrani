import { NextResponse } from "next/server";
import type { Lang } from "@/lib/i18n";
import { activeProvider, completeVision, AIError } from "@/lib/server/ai";
import { buildVisionSystemPrompt } from "@/lib/server/prompts";
import { parseAnalysis } from "@/lib/server/analysis";
import { getDemoPhotoAnalysis } from "@/lib/server/demo";
import { rateLimit, clientKey } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const MAX_IMAGE_B64 = 6_000_000; // ~4.5MB binary — generous vs the client's resized JPEGs

function sanitizeLang(raw: unknown): Lang {
  return raw === "en" ? "en" : "hi";
}

interface PhotoRequestBody {
  image?: unknown;
  mime?: unknown;
  lang?: unknown;
}

/**
 * Photo analysis (§8, §18). Server-side only vision call against the strict
 * JSON contract in prompts.ts. Malformed model JSON gets ONE silent retry
 * before failing; a missing AI key (or DEMO_MODE=true) returns a pre-tested
 * demo analysis so demos never break (§29, §34).
 */
export async function POST(request: Request) {
  const key = clientKey(request);
  const rl = rateLimit(`photo:${key}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rateLimited", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: PhotoRequestBody;
  try {
    body = (await request.json()) as PhotoRequestBody;
  } catch {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }

  const imageRaw = typeof body.image === "string" ? body.image : "";
  // Accept either raw base64 or a full data URL.
  const image = imageRaw.includes(",")
    ? imageRaw.slice(imageRaw.indexOf(",") + 1)
    : imageRaw;
  const mime =
    typeof body.mime === "string" &&
    /^image\/(jpeg|png|webp|heic|heif)$/.test(body.mime)
      ? body.mime
      : "image/jpeg";
  const lang = sanitizeLang(body.lang);

  if (!image || image.length < 100) {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_B64) {
    return NextResponse.json({ error: "imageTooLarge" }, { status: 413 });
  }

  // Demo mode (no AI key configured or DEMO_MODE=true): deterministic demo.
  if (activeProvider() === null) {
    const demo = getDemoPhotoAnalysis(image, lang);
    demo.demo = true;
    return NextResponse.json(demo);
  }

  const system = buildVisionSystemPrompt(lang);
  const userText =
    "Analyse this photo of a farmer's crop and reply with the JSON analysis only.";

  // One silent automatic retry on malformed JSON (§27).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await completeVision({
        system,
        userText,
        imageBase64: image,
        mime,
        maxTokens: 1100,
      });
      const parsed = parseAnalysis(raw, lang);
      if (parsed) return NextResponse.json(parsed);
    } catch (e) {
      if (attempt === 1) {
        return NextResponse.json(
          { error: "server", detail: e instanceof AIError ? e.message : undefined },
          { status: 502 }
        );
      }
    }
  }

  return NextResponse.json({ error: "server" }, { status: 502 });
}
