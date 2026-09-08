import { NextResponse } from "next/server";
import type { Lang } from "@/lib/i18n";
import type { ChatMessage } from "@/lib/types";
import { activeProvider, completeText, AIError } from "@/lib/server/ai";
import { buildChatSystemPrompt, SUMMARY_INSTRUCTION } from "@/lib/server/prompts";
import { getDemoChatReply } from "@/lib/server/demo";
import { rateLimit, clientKey } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const MAX_MESSAGE_LEN = 2000;
const HISTORY_LIMIT = 12;

function sanitizeLang(raw: unknown): Lang {
  return raw === "en" ? "en" : "hi";
}

interface ChatRequestBody {
  messages?: unknown;
  lang?: unknown;
  weather?: { locationName?: string; summary?: string } | null;
  photo?: {
    summary?: string;
    crop?: string | null;
    problem?: string | null;
    confidencePct?: number | null;
    source?: string | null;
  } | null;
  /** When true, produce the short end-of-conversation summary instead. */
  summarize?: unknown;
}

/**
 * Chat assistant (§8 Flow C). Server-side only. The rolling history (last
 * ~6–12 messages) plus optional weather/photo context is folded into the
 * system prompt; nothing is persisted server-side.
 */
export async function POST(request: Request) {
  const key = clientKey(request);
  const rl = rateLimit(`chat:${key}`, 120, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rateLimited", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }

  const lang = sanitizeLang(body.lang);
  const messages = (Array.isArray(body.messages) ? body.messages : []).filter(
    (m): m is ChatMessage =>
      !!m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
  );

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser || !lastUser.content.trim()) {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }
  if (lastUser.content.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "tooLong" }, { status: 413 });
  }

  const weatherSummary =
    body.weather && body.weather.summary ? body.weather.summary : null;
  const weatherLocation =
    body.weather && body.weather.locationName ? body.weather.locationName : null;
  const photoSummary = body.photo && body.photo.summary ? body.photo.summary : null;
  const photoCrop =
    body.photo && body.photo.crop ? body.photo.crop : null;
  const photoProblem =
    body.photo && body.photo.problem ? body.photo.problem : null;
  const photoConfidence =
    body.photo && typeof body.photo.confidencePct === "number"
      ? body.photo.confidencePct
      : null;
  const photoSource =
    body.photo && body.photo.source ? body.photo.source : null;
  const summarize = body.summarize === true;

  if (activeProvider() === null) {
    if (summarize) {
      return NextResponse.json({
        message:
          lang === "hi"
            ? "फ़सल:\nसमस्या:\nभरोसा:\nमहत्वपूर्ण सलाह:\nदवा/उत्पाद:\nचेतावनी:\nस्रोत:\n\n(सारांश तभी मिलेगा जब AI सेवा जुड़ी हो — GEMINI_API_KEY जोड़ें, SETUP-REPORT-PHOTO.md देखें।)"
            : "Crop:\nProblem:\nConfidence:\nImportant recommendation:\nMedicine/product discussed:\nWarning:\nSource:\n\n(A summary is only possible when the AI service is connected — add GEMINI_API_KEY, see SETUP-REPORT-PHOTO.md.)",
        demo: true,
        summary: true,
      });
    }
    const reply = getDemoChatReply(lang, lastUser.content, weatherSummary);
    // Let the demo responder reuse the photo context naturally.
    if (photoSummary && !/\b(photo|फोटो)\b/i.test(lastUser.content + reply.message)) {
      reply.message =
        reply.message +
        (lang === "hi"
          ? `\n\n(फोटो संदर्भ: ${photoSummary})`
          : `\n\n(Photo context: ${photoSummary})`);
    }
    return NextResponse.json(reply);
  }

  const recent = messages.slice(-HISTORY_LIMIT);
  const system = summarize
    ? SUMMARY_INSTRUCTION
    : buildChatSystemPrompt(lang, {
        weatherSummary,
        weatherLocation,
        photoSummary,
        photoCrop,
        photoProblem,
        photoConfidence,
        photoSource,
      });
  const turns =
    recent.length > 0
      ? recent
      : [{ role: "user" as const, content: lastUser.content }];

  try {
    const raw = await completeText({
      system,
      messages: turns.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: summarize ? 400 : 600,
    });
    const cleaned = raw.trim().slice(0, MAX_MESSAGE_LEN);
    if (!cleaned) {
      return NextResponse.json({ error: "server" }, { status: 502 });
    }
    return NextResponse.json({
      message: cleaned,
      demo: false,
      ...(summarize ? { summary: true } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "server",
        detail: e instanceof AIError ? e.message : undefined,
      },
      { status: 502 }
    );
  }
}
