/**
 * Server-side LLM client (§19, §21, §23). Keys live in env vars ONLY — never
 * shipped to the browser. Two providers are supported with no SDK dependency:
 * Anthropic Claude (default) or an OpenAI-compatible chat API (incl. GPT-4o
 * vision). Whichever key is configured wins; when no key is configured the
 * app runs in DEMO mode (see lib/server/demo.ts) so the product is fully
 * demoable with zero credentials (§34).
 */

export type Provider = "anthropic" | "openai";

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function activeProvider(): Provider | null {
  // DEMO_MODE=true forces demo even when keys exist; DEMO_MODE=false forces
  // live and will error without a key. Default = auto (live if any key).
  const mode = process.env.DEMO_MODE;
  if (mode === "true") return null;
  if (mode === "false") return hasAnthropicKey() ? "anthropic" : "openai";
  if (hasAnthropicKey()) return "anthropic";
  if (hasOpenAIKey()) return "openai";
  return null;
}

export class AIError extends Error {}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Plain-text LLM call. Returns the model's raw text. */
export async function completeText(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
}): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new AIError("no LLM provider configured (demo mode)");
  if (provider === "anthropic") return anthropicText(opts);
  return openaiText(opts);
}

/** Vision call: sends an image plus text to a multimodal model. */
export async function completeVision(opts: {
  system: string;
  userText: string;
  imageBase64: string;
  mime: string;
  maxTokens?: number;
}): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new AIError("no LLM provider configured (demo mode)");
  if (provider === "anthropic") return anthropicVision(opts);
  return openaiVision(opts);
}

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
  imageBase64: string;
  mime: string;
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
      max_tokens: opts.maxTokens ?? 900,
      system: opts.system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: opts.mime,
                data: opts.imageBase64,
              },
            },
            { type: "text", text: opts.userText },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
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

async function openaiChat(opts: {
  system: string;
  messages: ChatTurn[];
  image?: { base64: string; mime: string };
  maxTokens?: number;
}): Promise<string> {
  const content: unknown[] = [];
  if (opts.image) {
    content.push(
      { type: "text", text: opts.system + "\n\n" + (opts.messages[0]?.content ?? "") },
      {
        type: "image_url",
        image_url: {
          url: `data:${opts.image.mime};base64,${opts.image.base64}`,
        },
      }
    );
    opts = { ...opts, system: "" };
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
        messages: [
          { role: "system", content: opts.system },
          ...(opts.image
            ? [{ role: "user", content }]
            : opts.messages.map((m) => ({ role: m.role, content: m.content }))),
        ],
      }),
      signal: AbortSignal.timeout(60_000),
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
  imageBase64: string;
  mime: string;
  maxTokens?: number;
}): Promise<string> {
  return openaiChat({
    system: opts.system,
    messages: [{ role: "user", content: opts.userText }],
    image: { base64: opts.imageBase64, mime: opts.mime },
    maxTokens: opts.maxTokens,
  });
}
