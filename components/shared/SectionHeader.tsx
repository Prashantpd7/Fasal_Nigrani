"use client";

import type { ReactNode } from "react";

interface SectionHeaderProps {
  icon: ReactNode;
  text: string;
  hint?: string;
}

/** Consistent section title with a leading icon (v2 UI kit). Uses the shared
 *  .section-head style so every page's headings are pixel-identical. */
export default function SectionHeader({ icon, text, hint }: SectionHeaderProps) {
  return (
    <h2 className="section-head">
      <span className="shrink-0 text-primary">{icon}</span>
      {text}
      {hint ? (
        <span className="sr-only"> · {hint}</span>
      ) : null}
    </h2>
  );
}