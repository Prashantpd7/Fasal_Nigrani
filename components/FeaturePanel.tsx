"use client";

import { useState, type ReactNode } from "react";
import { ChevronRightIcon } from "@/components/icons";

interface FeaturePanelProps {
  icon: ReactNode;
  title: string;
  desc: string;
  /** Loading placeholder shown while the lazy-imported feature loads. */
  children: ReactNode;
  /** Subtle trailing meta text (e.g. data source) — avoid badges. */
  meta?: string;
  defaultOpen?: boolean;
}

/**
 * Expandable section for the single-page dashboard. Clicking a card opens the
 * real feature content IN PLACE (lazy-loaded) — no navigation, no page
 * transitions. Compact header: icon + title + one supporting line + chevron.
 */
export default function FeaturePanel({
  icon,
  title,
  desc,
  children,
  meta,
  defaultOpen = false,
}: FeaturePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card-sm overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer select-none items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-primary-light/30"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            {icon}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
            <span className="text-[1.02rem] font-bold leading-snug text-ink">
              {title}
            </span>
            <span className="text-[0.86rem] leading-relaxed text-ink-soft">
              {desc}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {meta ? (
            <span className="text-[0.75rem] font-semibold text-primary/80">{meta}</span>
          ) : null}
          <span
            aria-hidden="true"
            className={`transform transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          >
            <ChevronRightIcon size={20} className="text-earth/70" />
          </span>
        </span>
      </button>
      {open ? (
        <div className="border-t border-earth/15 px-4 py-4">{children}</div>
      ) : null}
    </section>
  );
}