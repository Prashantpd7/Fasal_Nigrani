"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageShell from "@/components/PageShell";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import { useI18n } from "@/lib/I18nProvider";
import { readLastWeather, readPhotoContext } from "@/lib/clientStore";
import type { ChatMessage, ChatRequestContext } from "@/lib/types";

const MAX_HISTORY = 10;

/**
 * Flow C (§8): typed or spoken question -> LLM reply with weather and/or the
 * latest photo-analysis attached as context. Context is only attached when it
 * was produced in the current language — never mix languages into an answer
 * (§16). Rolling history lives in session state; nothing persists server-side.
 */
export default function ChatPage() {
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
      photo: photo && photo.lang === lang ? { summary: photo.summary } : null,
    };
  }, [lang]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const send = async (text: string) => {
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history.slice(-MAX_HISTORY));
    setError(null);
    setThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-MAX_HISTORY),
          lang,
          weather: context.weather,
          photo: context.photo,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!res.ok || !data || typeof data.message !== "string") {
        setError(t("chat.error"));
        return;
      }
      const reply = data.message;
      setMessages((prev) => [
        ...prev.slice(-MAX_HISTORY),
        { role: "assistant", content: reply },
      ]);
    } catch {
      setError(t("chat.error"));
    } finally {
      setThinking(false);
    }
  };

  const hasContext = Boolean(context.weather || context.photo);

  return (
    <PageShell title={t("chat.title")} subtitle={t("chat.subtitle")} backHref="/">
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
            <span className="chip bg-primary-light text-primary">
              {t("chat.contextPhoto")}
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border-2 border-danger/30 bg-danger-light p-3 text-[0.98rem] font-semibold text-ink">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {messages.length === 0 && !thinking ? (
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
                  className="rounded-2xl border border-earth/20 bg-bg px-4 py-3 text-left text-[0.98rem] font-semibold text-ink transition-colors hover:border-primary/40 hover:bg-primary-light/40"
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
                <div className="attention-pulse max-w-[85%] rounded-3xl rounded-bl-md border border-earth/15 bg-surface px-4 py-3 text-[0.98rem] font-semibold text-ink-soft">
                  {t("chat.thinking")}
                </div>
              </div>
            ) : null}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <p className="mb-1 mt-1 text-center text-[0.85rem] font-medium text-ink-soft">
        {t("chat.disclaimer")}
      </p>

      <ChatInput onSend={(text) => void send(text)} disabled={thinking} />
    </PageShell>
  );
}
