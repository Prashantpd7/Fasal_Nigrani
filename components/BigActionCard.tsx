"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "./icons";

interface Props {
  href: string;
  icon: ReactNode;
  title: string;
  desc: string;
  accent: "green" | "blue" | "amber" | "earth" | "info";
  /** Compact 2-col grid tile (smaller icon + tighter type). */
  compact?: boolean;
  external?: boolean;
}

const accents = {
  green: {
    ring: "hover:border-primary/50 hover:bg-primary-light/40",
    iconWrap: "bg-primary-light text-primary",
  },
  blue: {
    ring: "hover:border-info/40 hover:bg-info-light/40",
    iconWrap: "bg-info-light text-info",
  },
  amber: {
    ring: "hover:border-warning/40 hover:bg-warning-light/40",
    iconWrap: "bg-warning-light text-warning",
  },
  earth: {
    ring: "hover:border-earth/40 hover:bg-earth-light/40",
    iconWrap: "bg-earth-light text-earth",
  },
  info: {
    ring: "hover:border-info/40 hover:bg-info-light/40",
    iconWrap: "bg-info-light text-info",
  },
} as const;

/** One of the homepage's action tiles (§13). Min 56px+, always ≥2 taps from
 *  the homepage to any result. */
export default function BigActionCard({
  href,
  icon,
  title,
  desc,
  accent,
  compact = false,
  external = false,
}: Props) {
  const a = accents[accent];

  if (compact) {
    return (
      <Link
        href={href}
        aria-label={title}
        className={`card-sm group flex min-h-24 cursor-pointer flex-col items-start gap-2 transition-colors ${a.ring}`}
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${a.iconWrap}`}
        >
          {icon}
        </span>
        <span className="w-full text-left">
          <span className="text-[1.02rem] font-extrabold leading-snug text-ink">
            {title}
          </span>
          <span className="mt-1 line-clamp-2 block text-[0.82rem] leading-relaxed text-ink-soft">
            {desc}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`card-sm group flex min-h-24 cursor-pointer items-center gap-4 transition-colors ${a.ring}`}
    >
      <span
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${a.iconWrap}`}
      >
        {icon}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[1.18rem] font-extrabold leading-snug text-ink">
          {title}
        </span>
        <span className="text-[0.95rem] leading-relaxed text-ink-soft">
          {desc}
        </span>
      </span>
      <ChevronRightIcon
        size={22}
        className="shrink-0 text-earth/60 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
