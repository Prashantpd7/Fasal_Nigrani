"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "./icons";

interface Props {
  href: string;
  icon: ReactNode;
  title: string;
  desc: string;
  accent: "green" | "blue" | "amber";
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
} as const;

/** One of the homepage's primary action tiles (§13). Min 56px+, always ≥2 taps
 *  from the homepage to any result. */
export default function BigActionCard({
  href,
  icon,
  title,
  desc,
  accent,
}: Props) {
  const a = accents[accent];
  return (
    <Link
      href={href}
      className={`card group flex min-h-24 cursor-pointer items-center gap-4 p-4 transition-colors sm:p-5 ${a.ring}`}
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
