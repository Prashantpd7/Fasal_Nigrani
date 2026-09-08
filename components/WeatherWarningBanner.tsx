"use client";

import type { Severity } from "@/lib/types";
import { InfoIcon, WarningIcon } from "./icons";

const styles: Record<
  Severity,
  { box: string; iconColor: string; label: string }
> = {
  danger: {
    box: "border-danger/35 bg-danger-light",
    iconColor: "text-danger",
    label: "important",
  },
  warning: {
    box: "border-warning/35 bg-warning-light",
    iconColor: "text-warning",
    label: "caution",
  },
  info: {
    box: "border-info/35 bg-info-light",
    iconColor: "text-info",
    label: "information",
  },
};

/** §13: <WeatherWarningBanner severity message />. Red is reserved for real
 *  urgency only; each banner pairs colour with an icon + text (§15). */
export default function WeatherWarningBanner({
  severity,
  message,
}: {
  severity: Severity;
  message: string;
}) {
  const s = styles[severity];
  return (
    <div
      role="alert"
      aria-label={s.label}
      className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${s.box}`}
    >
      <span className={`mt-0.5 shrink-0 ${s.iconColor}`}>
        {severity === "danger" ? (
          <WarningIcon size={24} />
        ) : (
          <InfoIcon size={24} />
        )}
      </span>
      <p className="text-[1.02rem] font-semibold leading-relaxed text-ink">
        {message}
      </p>
    </div>
  );
}
