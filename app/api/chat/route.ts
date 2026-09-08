import { NextResponse } from "next/server";
import type { Lang } from "@/lib/i18n";
import type { ChatMessage } from "@/lib/types";
import { activeProvider, completeText, AIError } from "@/lib/server/ai";
import { buildChatSystemPrompt } from "@/lib/server/prompts";
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
  photo?: { summary?: string } | null;
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

  if (activeProvider() === null) {
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
  const system = buildChatSystemPrompt(lang, {
    weatherSummary,
    weatherLocation,
    photoSummary,
  });

  try {
    const raw = await completeText({
      system,
      messages: recent.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 600,
    });
    const cleaned = raw.trim().slice(0, MAX_MESSAGE_LEN);
    if (!cleaned) {
      return NextResponse.json({ error: "server" }, { status: 502 });
    }
    return NextResponse.json({ message: cleaned, demo: false });
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
