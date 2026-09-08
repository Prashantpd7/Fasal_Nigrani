"use client";

import { InfoIcon } from "../icons";
import { useI18n } from "@/lib/I18nProvider";

/** Honest labelling of data provenance (§28, §34): live vs demo vs stale. */
export function SourceChip({ source }: { source: "live" | "demo" }) {
  const { t } = useI18n();
  if (source === "demo") {
    return (
      <span className="chip bg-warning-light text-warning">
        <InfoIcon size={15} />
        {t("common.demoData")}
      </span>
    );
  }
  return (
    <span className="chip bg-primary-light text-primary">
      <InfoIcon size={15} />
      {t("common.liveData")}
    </span>
  );
}

export function StaleChip() {
  const { t } = useI18n();
  return (
    <span className="chip bg-warning-light text-warning">
      <InfoIcon size={15} />
      {t("common.staleNote")}
    </span>
  );
}
