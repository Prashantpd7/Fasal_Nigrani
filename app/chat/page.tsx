"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageShell from "@/components/PageShell";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import LoadingState from "@/components/shared/LoadingState";
import { useI18n } from "@/lib/I18nProvider";
import {
  cachePhotoContext,
  readLastWeather,
  readPhotoContext,
  readCachedFarmState,
} from "@/lib/clientStore";
import { assessQuality, prepareImage, fileTooLarge } from "@/lib/clientImage";
import type { ChatMessage, ChatRequestContext } from "@/lib/types";

const MAX_HISTORY = 10;

/**
 * Flow C (§24): typed or spoken question -> LLM reply with weather and/or the
 * latest crop-photo analysis attached as context. The farmer can also attach a
 * NEW photo right here: it runs the real analysis pipeline (Gemini +
 * knowledge verification) and the result becomes context for follow-ups. A
 * "Summary" button produces the short end-of-conversation summary.
 */
export default function ChatPage({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const { t, lang, dict } = useI18n();

  // Derived on every render (localStorage reads are tiny and synchronous), so
  // switching language instantly re-evaluates which context applies.
  const context = useMemo<ChatRequestContext>(() => {
    const weather = readLastWeather();
    const photo = readPhotoContext();
    return {
      weather:
        weather && weather.lang === lang
          ? {
              locationName: weather.payload.locationName,
              summary: weather.payload.summary,
            }
          : null,
      photo:
        photo && photo.lang === lang
          ? {
              summary: photo.summary,
              crop: photo.crop ?? null,
              problem: photo.problem ?? null,
              confidencePct: photo.confidencePct ?? null,
              source: photo.source ?? null,
            }
          : null,
    };
  }, [lang]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking, attaching]);

  const send = async (text: string, summarize = false) => {
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history.slice(-MAX_HISTORY));
    setError(null);
    if (summarize) setSummaryBusy(true);
    else setThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-MAX_HISTORY),
          lang,
          weather: context.weather,
          photo: context.photo,
          summarize,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        summary?: boolean;
      } | null;
      if (!res.ok || !data || typeof data.message !== "string") {
        setError(t("chat.error"));
        return;
      }
      const reply = data.message;
      if (summarize) {
        setSummary(reply);
        return;
      }
      setMessages((prev) => [
        ...prev.slice(-MAX_HISTORY),
        { role: "assistant", content: reply },
      ]);
    } catch {
      setError(t("chat.error"));
    } finally {
      setThinking(false);
      setSummaryBusy(false);
    }
  };

  /** Attach a photo: real analysis first, then a follow-up question in chat. */
  const attachPhoto = async (file: File) => {
    setAttachError(null);
    if (fileTooLarge(file)) {
      setAttachError(t("photo.imageTooBig"));
      return;
    }
    setAttaching(true);
    try {
      let issue: "ok" | "too_dark" | "too_blurry";
      try {
        issue = await assessQuality(file);
      } catch {
        issue = "ok";
      }
      if (issue !== "ok") {
        setAttachError(t("photo.qualityTooPoor"));
        return;
      }
      const prepared = await prepareImage(file);
      const farm = readCachedFarmState();
      const res = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          images: [{ image: prepared.base64, mime: prepared.mime }],
          lang,
          lat: farm?.lat ?? null,
          lon: farm?.lon ?? null,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        confidence_pct?: number;
        explanation_simple?: string;
        likely_problem?: string | null;
        crop?: string | null;
        source?: string;
        error?: string;
      } | null;
      if (res.status === 503 && data?.error === "not_configured") {
        setAttachError(t("chat.photoNotConfigured"));
        return;
      }
      if (!res.ok || !data || typeof data.confidence_pct !== "number") {
        setAttachError(t("errors.network"));
        return;
      }
      const summaryLine = data.explanation_simple ?? "";
      cachePhotoContext({
        summary: summaryLine.slice(0, 300),
        at: Date.now(),
        lang,
        crop: data.crop ?? null,
        problem: data.likely_problem ?? null,
        confidencePct: data.confidence_pct,
        source: data.source ?? null,
        location: farm?.label ?? null,
      });
      // Ask a follow-up about the attached photo.
      void send(
        lang === "hi"
          ? `मैंने एक फोटो भेजी है। जाँच का सारांश: ${summaryLine}`
          : `I just attached a photo. Analysis summary: ${summaryLine}`
      );
    } catch {
      setAttachError(t("errors.network"));
    } finally {
      setAttaching(false);
    }
  };

  const hasContext = Boolean(context.weather || context.photo);

  return (
    <PageShell embedded={embedded} title={t("chat.title")} subtitle={t("chat.subtitle")}>
      {hasContext ? (
        <div className="flex flex-wrap gap-2" aria-label="context">
          {context.weather ? (
            <span className="chip bg-info-light text-info">
              {t("chat.contextWeather", {
                place: context.weather.locationName,
              })}
            </span>
          ) : null}
          {context.photo ? (
            <span className="chip bg-primary-light text-primary" title={context.photo.summary}>
              {t("chat.contextPhoto")}
              {context.photo.crop ? ` · ${context.photo.crop}` : ""}
              {context.photo.problem ? ` · ${context.photo.problem}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {attachError ? (
        <div className="rounded-2xl border-2 border-warning/40 bg-warning-light p-3 text-[0.95rem] font-semibold text-ink">
          {attachError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border-2 border-danger/30 bg-danger-light p-3 text-[0.98rem] font-semibold text-ink">
          {error}
        </div>
      ) : null}

      {/* Conversation summary (short, only the important info) */}
      {summary ? (
        <div className="card border-2 border-primary/30">
          <h2 className="mb-2 flex items-center gap-2 text-[1.02rem] font-extrabold text-primary">
            {t("chat.summaryTitle")}
          </h2>
          <pre className="whitespace-pre-wrap font-sans text-[0.95rem] leading-relaxed text-ink">
            {summary}
          </pre>
        </div>
      ) : null}

      {summaryBusy ? (
        <LoadingState message={t("chat.summaryThinking")} />
      ) : null}

      <div className="flex flex-col gap-2.5">
        {messages.length === 0 && !thinking && !attaching && !summary ? (
          <div className="card border-dashed text-center">
            <p className="text-[0.98rem] leading-relaxed text-ink-soft">
              {t("chat.subtitle")}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {dict.chat.quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="tile block w-full px-4 py-3 text-left text-[0.98rem] font-semibold text-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pb-2">
            {messages.map((m, i) => (
              <ChatBubble key={i} message={m} />
            ))}
            {thinking ? (
              <div className="flex justify-start">
                <div className="attention-pulse w-full md:w-[780px] rounded-3xl rounded-bl-md border border-earth/15 bg-surface px-4 py-3 text-[0.98rem] font-semibold text-ink-soft">
                  {t("chat.thinking")}
                </div>
              </div>
            ) : null}
            {attaching ? (
              <div className="flex justify-start">
                <div className="attention-pulse w-full md:w-[780px] rounded-3xl rounded-bl-md border border-earth/15 bg-surface px-4 py-3 text-[0.98rem] font-semibold text-ink-soft">
                  {t("chat.photoAnalyzing")}
                </div>
              </div>
            ) : null}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Summary button — short recap at the end of the conversation */}
      {messages.length > 0 && !summary ? (
        <button
          type="button"
          className="btn-secondary w-full"
          disabled={thinking || summaryBusy}
          onClick={() => {
            const last = messages[messages.length - 1];
            void send(
              last && last.role === "user" ? last.content : t("chat.summaryRequest"),
              true
            );
          }}
        >
          {t("chat.summaryButton")}
        </button>
      ) : null}

      <p className="mb-1 mt-1 text-center text-[0.85rem] font-medium text-ink-soft">
        {t("chat.disclaimer")}
      </p>

      <ChatInput
        onSend={(text) => void send(text)}
        disabled={thinking || summaryBusy}
        onAttach={(f) => void attachPhoto(f)}
        attachBusy={attaching}
      />
    </PageShell>
  );
}