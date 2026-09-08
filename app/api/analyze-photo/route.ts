import { NextResponse } from "next/server";
import type { Lang } from "@/lib/i18n";
import { activeProvider, completeVision, AIError, type ImagePart } from "@/lib/server/ai";
import { buildVisionSystemPrompt } from "@/lib/server/prompts";
import { parseVisionJson, buildResult, getPlantIdSignal } from "@/lib/server/cropAnalysis";
import { rateLimit, clientKey } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const MAX_IMAGES = 4;
const MAX_IMAGE_B64 = 6_000_000; // ~4.5MB binary per image
const MAX_TOTAL_B64 = 20_000_000;

function sanitizeLang(raw: unknown): Lang {
  return raw === "en" ? "en" : "hi";
}

interface PhotoRequestBody {
  images?: unknown;
  image?: unknown;
  mime?: unknown;
  lang?: unknown;
  lat?: unknown;
  lon?: unknown;
}

function toImagePart(raw: unknown, fallbackMime: string): ImagePart | null {
  let value: string;
  let mime = fallbackMime;
  if (typeof raw === "string") {
    value = raw;
  } else if (raw && typeof raw === "object") {
    const image = raw as { image?: unknown; mime?: unknown };
    if (typeof image.image !== "string") return null;
    value = image.image;
    if (
      typeof image.mime === "string" &&
      /^image\/(jpeg|png|webp|heic|heif)$/.test(image.mime)
    ) {
      mime = image.mime;
    }
  } else {
    return null;
  }

  let b64 = value;
  if (value.includes(",")) {
    const [head, data] = value.split(",", 2);
    const m = /^data:([^;]+);base64$/.exec(head);
    if (m && /^image\/(jpeg|png|webp|heic|heif)$/.test(m[1])) mime = m[1];
    b64 = data;
  }
  if (!b64 || b64.length < 100) return null;
  return { base64: b64, mime };
}

/**
 * Crop photo analysis (§ Photo — real AI). Server-side only.
 *
 * 1. Validates every image (type/size/count).
 * 2. Runs the vision model (Gemini by default) over ALL images together.
 * 3. Verifies suspicions against the trusted ICAR/KVK knowledge base.
 * 4. Optionally consults Plant.id as an additional signal (never truth).
 * 5. Returns a farmer-friendly result — or an honest error. There is NO demo
 *    fallback: without a model key this route returns a clear configuration
 *    error for the developer, never fake farmer results.
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

  const lang = sanitizeLang(body.lang);
  const fallbackMime =
    typeof body.mime === "string" &&
    /^image\/(jpeg|png|webp|heic|heif)$/.test(body.mime)
      ? body.mime
      : "image/jpeg";

  // Accept both the new multi-image field and the old single-image field.
  const rawImages = Array.isArray(body.images)
    ? body.images
    : body.image
      ? [body.image]
      : [];
  if (rawImages.length === 0) {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }
  if (rawImages.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: "tooManyImages", max: MAX_IMAGES },
      { status: 413 }
    );
  }

  const images = rawImages
    .map((raw) => toImagePart(raw, fallbackMime))
    .filter((p): p is ImagePart => p !== null);
  if (images.length === 0) {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }
  if (images.some((i) => i.base64.length > MAX_IMAGE_B64)) {
    return NextResponse.json({ error: "imageTooLarge" }, { status: 413 });
  }
  const total = images.reduce((s, i) => s + i.base64.length, 0);
  if (total > MAX_TOTAL_B64) {
    return NextResponse.json({ error: "imageTooLarge" }, { status: 413 });
  }

  // Real AI only. No key -> clear configuration error (never fake results).
  if (activeProvider() === null) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "AI photo analysis is not connected. Add GEMINI_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY) to your .env file and restart. See SETUP-REPORT-PHOTO.md.",
      },
      { status: 503 }
    );
  }

  const lat =
    typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lon =
    typeof body.lon === "number" && Number.isFinite(body.lon) ? body.lon : null;

  const system = buildVisionSystemPrompt(lang);
  const userText = `Analyse these photos of a farmer's crop and reply with the JSON analysis only.`;

  // Plant.id as an ADDITIONAL signal (parallel, non-blocking on failure).
  const plantIdPromise = getPlantIdSignal(images, lat, lon);

  // One silent automatic retry on malformed JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await completeVision({
        system,
        userText,
        images,
        maxTokens: 1400,
      });
      const parsed = parseVisionJson(raw);
      if (parsed) {
        const plantId = await plantIdPromise;
        const result = buildResult(parsed, lang, images.length, plantId);
        return NextResponse.json(result);
      }
    } catch (e) {
      if (attempt === 1) {
        return NextResponse.json(
          {
            error: "server",
            message:
              e instanceof AIError
                ? e.message
                : "The vision provider could not analyze the uploaded image.",
          },
          { status: 502 }
        );
      }
    }
  }

  return NextResponse.json({ error: "server" }, { status: 502 });
}