"use client";

import type { ChatMessage } from "@/lib/types";

/** §13 ChatBubble: assistant answers on the left (surface), user on the right
 *  (primary green) with generous, readable text. */
export default function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      role="log"
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-[1rem] leading-relaxed ${
          isUser
            ? "rounded-br-md bg-primary text-white"
            : "rounded-bl-md border border-earth/15 bg-surface text-ink"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
