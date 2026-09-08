"use client";

import { useId } from "react";

interface SparklineProps {
  /** Time-ordered numbers. Nulls are skipped (NR days). */
  values: (number | null)[];
  width?: number;
  height?: number;
  stroke?: string;
  fillStroke?: string;
  ariaLabel: string;
}

/**
 * Tiny inline line chart for price trends. Pure SVG — no chart library, no new
 * colours (defaults to the primary green, override via stroke/fillStroke).
 * Always has a text label so colour/position is never the only signal.
 */
export default function Sparkline({
  values,
  width = 120,
  height = 34,
  stroke = "var(--color-primary)",
  fillStroke = "var(--color-primary-light)",
  ariaLabel,
}: SparklineProps) {
  const uid = useId();
  const pts = values.filter((v) => v !== null);
  if (pts.length < 2) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-ink-soft"
        role="img"
        aria-label={ariaLabel}
      >
        {pts.length === 1 ? "—" : "·"}
      </span>
    );
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(max - min, 1);
  const pad = 4;
  const w = width;
  const h = height;
  const step = (w - pad * 2) / Math.max(pts.length - 1, 1);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2 - 6);
  const coords = (pts as number[]).map((v, i) => `${pad + i * step},${y(v)}`);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="shrink-0"
    >
      <polygon
        points={`${pad},${h - pad} ${coords.join(" ")} ${w - pad},${h - pad}`}
        fill={fillStroke}
        stroke="none"
        opacity="0.5"
      />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={coords[coords.length - 1].split(",")[0]}
        cy={coords[coords.length - 1].split(",")[1]}
        r="2.4"
        fill={stroke}
      />
    </svg>
  );
}