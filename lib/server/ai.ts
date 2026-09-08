/**
 * Server-side LLM client (§19, §21, §23). Keys live in env vars ONLY — never
 * shipped to the browser. Three providers are supported with no SDK
 * dependency:
 *   1. Google Gemini (default when GEMINI_API_KEY is set — the crop-analysis
 *      requirement), via the REST generateContent endpoint.
 *   2. Anthropic Claude (vision-capable).
 *   3. Any OpenAI-compatible chat API (incl. GPT-4o vision).
 * Provider priority: Gemini -> Anthropic -> OpenAI. When no key is configured
 * the AI routes report an honest "not configured" error — the app NEVER fakes
 * a model reply (photo analysis in particular must not show demo results).
 */

export type Provider = "anthropic" | "openai" | "google";

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function activeProvider(): Provider | null {
  // DEMO_MODE=true forces the demo chat responder; DEMO_MODE=false forces live
  // and will error without a key. Photo analysis NEVER uses demo data — with
  // no key it returns a clear configuration error instead.
  const mode = process.env.DEMO_MODE;
  if (mode === "true") return null;
  if (mode === "false") {
    if (hasGeminiKey()) return "google";
    if (hasAnthropicKey()) return "anthropic";
    return "openai";
  }
  if (hasGeminiKey()) return "google";
  if (hasAnthropicKey()) return "anthropic";
  if (hasOpenAIKey()) return "openai";
  return null;
}

export class AIError extends Error {}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ImagePart {
  base64: string;
  mime: string;
}

/** Plain-text LLM call. Returns the model's raw text. */
export async function completeText(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
}): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new AIError("no LLM provider configured");
  if (provider === "google") return googleGenerate(opts);
  if (provider === "anthropic") return anthropicText(opts);
  return openaiText(opts);
}

/** Vision call: sends one or more images plus text to a multimodal model. */
export async function completeVision(opts: {
  system: string;
  userText: string;
  images: ImagePart[];
  maxTokens?: number;
}): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new AIError("no LLM provider configured");
  if (provider === "google") return googleVision(opts);
  if (provider === "anthropic") return anthropicVision(opts);
  return openaiVision(opts);
}

// ---------------------------------------------------------------------------
// Google Gemini (generateContent REST)
// ---------------------------------------------------------------------------

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function geminiModel(): string {
  // gemini-2.5-flash is deprecated (no longer available to new users);
  // gemini-3.6-flash is the current supported model. GEMINI_MODEL can
  // override the default.
  return process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
}

async function geminiRequest(opts: {
  system: string;
  parts: unknown[];
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch(
    `${GEMINI_BASE}/models/${geminiModel()}:generateContent?key=${encodeURIComponent(
      process.env.GEMINI_API_KEY!
    )}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: opts.system }, ...opts.parts],
          },
        ],
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 1000,
          temperature: 0.3,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    }
  );
  const j = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok || !j.candidates?.[0]?.content?.parts) {
    throw new AIError(j.error?.message ?? `Gemini HTTP ${res.status}`);
  }
  const text = j.candidates[0].content.parts
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new AIError("Gemini empty reply");
  return text;
}

async function googleGenerate(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
}): Promise<string> {
  const parts = opts.messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));
  // Gemini needs alternating roles; flatten system into the first user turn.
  const contents = [
    { role: "user", parts: [{ text: opts.system }] },
    ...parts,
  ];
  const res = await fetch(
    `${GEMINI_BASE}/models/${geminiModel()}:generateContent?key=${encodeURIComponent(
      process.env.GEMINI_API_KEY!
    )}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 600,
          temperature: 0.4,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    }
  );
  const j = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok || !j.candidates?.[0]?.content?.parts) {
    throw new AIError(j.error?.message ?? `Gemini HTTP ${res.status}`);
  }
  const text = j.candidates[0].content.parts
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new AIError("Gemini empty reply");
  return text;
}

async function googleVision(opts: {
  system: string;
  userText: string;
  images: ImagePart[];
  maxTokens?: number;
}): Promise<string> {
  const parts: unknown[] = [{ text: opts.userText }];
  for (const img of opts.images) {
    parts.push({
      inline_data: { mime_type: img.mime, data: img.base64 },
    });
  }
  return geminiRequest({
    system: opts.system,
    parts,
    maxTokens: opts.maxTokens ?? 1200,
  });
}

// ---------------------------------------------------------------------------
// Anthropic Claude
// ---------------------------------------------------------------------------

async function anthropicText(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
      max_tokens: opts.maxTokens ?? 600,
      system: opts.system,
      messages: opts.messages,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const j = (await res.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string };
  };
  if (!res.ok || !j.content) {
    throw new AIError(j.error?.message ?? `Anthropic HTTP ${res.status}`);
  }
  return j.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");
}

async function anthropicVision(opts: {
  system: string;
  userText: string;
  images: ImagePart[];
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
      max_tokens: opts.maxTokens ?? 1200,
      system: opts.system,
      messages: [
        {
          role: "user",
          content: [
            ...opts.images.map((img) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: img.mime,
                data: img.base64,
              },
            })),
            { type: "text", text: opts.userText },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(75_000),
  });
  const j = (await res.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string };
  };
  if (!res.ok || !j.content) {
    throw new AIError(j.error?.message ?? `Anthropic HTTP ${res.status}`);
  }
  return j.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");
}

// ---------------------------------------------------------------------------
// OpenAI-compatible
// ---------------------------------------------------------------------------

async function openaiChat(opts: {
  system: string;
  messages: ChatTurn[];
  images?: ImagePart[];
  maxTokens?: number;
}): Promise<string> {
  const content: unknown[] = [];
  if (opts.images && opts.images.length > 0) {
    content.push({
      type: "text",
      text: opts.system + "\n\n" + (opts.messages[0]?.content ?? ""),
    });
    for (const img of opts.images) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${img.mime};base64,${img.base64}`,
        },
      });
    }
  }
  const res = await fetch(
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        max_tokens: opts.maxTokens ?? 600,
        messages:
          opts.images && opts.images.length > 0
            ? [{ role: "system", content: "" }, { role: "user", content }]
            : [
                { role: "system", content: opts.system },
                ...opts.messages.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
              ],
      }),
      signal: AbortSignal.timeout(75_000),
    }
  );
  const j = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok || !j.choices?.[0]?.message?.content) {
    throw new AIError(j.error?.message ?? `OpenAI HTTP ${res.status}`);
  }
  return j.choices[0].message.content;
}

async function openaiText(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
}): Promise<string> {
  return openaiChat(opts);
}

async function openaiVision(opts: {
  system: string;
  userText: string;
  images: ImagePart[];
  maxTokens?: number;
}): Promise<string> {
  return openaiChat({
    system: opts.system,
    messages: [{ role: "user", content: opts.userText }],
    images: opts.images,
    maxTokens: opts.maxTokens,
  });
}