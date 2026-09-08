"use client";

import type { ReactNode } from "react";
import { SproutIcon } from "../icons";

interface Props {
  title: string;
  desc: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/** Friendly empty states that explain what will happen (§27). */
export default function EmptyState({ title, desc, icon, action }: Props) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
        {icon ?? <SproutIcon size={34} />}
      </span>
      <h2 className="text-[1.2rem] font-bold text-ink">{title}</h2>
      <p className="max-w-md text-[0.98rem] leading-relaxed text-ink-soft">
        {desc}
      </p>
      {action}
    </div>
  );
}
