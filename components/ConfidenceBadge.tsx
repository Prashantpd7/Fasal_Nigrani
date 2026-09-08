"use client";

import type { Confidence } from "@/lib/types";
import { useI18n } from "@/lib/I18nProvider";

const map: Record<
  Confidence,
  { chip: string; dot: string; labelKey: string }
> = {
  low: {
    chip: "bg-warning-light text-warning",
    dot: "bg-warning",
    labelKey: "photo.confidence.low",
  },
  medium: {
    chip: "bg-info-light text-info",
    dot: "bg-info",
    labelKey: "photo.confidence.medium",
  },
  high: {
    chip: "bg-success-light text-success",
    dot: "bg-success",
    labelKey: "photo.confidence.high",
  },
};

/** §13 ConfidenceBadge. Red is never used for low confidence — it is reserved
 *  only for seek_expert urgency on the result card (§8, §24). */
export default function ConfidenceBadge({ level }: { level: Confidence }) {
  const { t } = useI18n();
  const m = map[level];
  return (
    <span
      className={`chip ${m.chip}`}
      title={t("photo.confidence.label")}
    >
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      {t(m.labelKey)}
    </span>
  );
}
