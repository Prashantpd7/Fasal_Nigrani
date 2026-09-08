"use client";

import type { ReactNode } from "react";

interface NoticeBoxProps {
  icon: ReactNode;
  children: ReactNode;
  tone?: "info" | "warning" | "danger" | "success";
}

const tones = {
  info: "border-info/25 bg-info-light",
  warning: "border-dashed border-warning/40 bg-warning-light",
  danger: "border-dashed border-danger/40 bg-danger-light",
  success: "border-primary/25 bg-primary-light",
} as const;

/** Accessible notice/insight box (v2 UI kit). */
export default function NoticeBox({
  icon,
  children,
  tone = "info",
}: NoticeBoxProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 ${tones[tone]}`}
      role="note"
    >
      <span className="mt-0.5 shrink-0 text-ink">{icon}</span>
      <div className="flex-1 text-[0.95rem] leading-relaxed text-ink">
        {children}
      </div>
    </div>
  );
}