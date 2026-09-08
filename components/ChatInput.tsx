"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/I18nProvider";
import { MicIcon, SendIcon } from "./icons";

/**
 * §13 ChatInput: large text field + visible mic (Web Speech API) for voice.
 * Voice is strictly progressive enhancement — browsers without SpeechRecognition
 * fall back to typing without blocking the flow (§8 Flow C, §15).
 */

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { [i: number]: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor =
    w.SpeechRecognition ??
    (w as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  return Ctor ? (new (Ctor as new () => SpeechRecognitionLike)()) : null;
}

export default function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
    };
  }, []);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setText("");
    setVoiceError(false);
    onSend(trimmed);
  };

  const toggleVoice = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = getSpeechRecognition();
    if (!rec) {
      setVoiceError(true);
      return;
    }
    setVoiceError(false);
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        inputRef.current?.focus();
      }
    };
    rec.onerror = () => {
      setListening(false);
      setVoiceError(true);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setVoiceError(true);
    }
  };

  return (
    <div className="sticky bottom-0 -mx-4 border-t border-earth/10 bg-bg/95 px-4 pb-3 pt-2 backdrop-blur">
      {voiceError ? (
        <p className="mb-1.5 text-[0.85rem] font-semibold text-warning">
          {t("chat.voiceUnsupported")}
        </p>
      ) : null}
      {listening ? (
        <p
          role="status"
          className="attention-pulse mb-1.5 flex items-center gap-1.5 text-[0.9rem] font-bold text-danger"
        >
          <MicIcon size={16} />
          {t("chat.listening")}
        </p>
      ) : null}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <button
          type="button"
          aria-label={t("chat.micAlt")}
          onClick={toggleVoice}
          className={`flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors ${
            listening
              ? "attention-pulse border-danger bg-danger text-white"
              : "border-earth/25 bg-surface text-earth hover:bg-earth-light/60"
          }`}
        >
          <MicIcon size={22} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          enterKeyHint="send"
          className="min-h-14 flex-1 rounded-full border border-earth/25 bg-surface px-4 text-[1rem] text-ink placeholder:text-ink-soft/70 focus:border-primary"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label={t("chat.send")}
          className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-[0.97] hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          <SendIcon size={20} />
        </button>
      </form>
    </div>
  );
}
