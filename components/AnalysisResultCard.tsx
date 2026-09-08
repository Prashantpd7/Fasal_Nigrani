"use client";

import type { ReactNode } from "react";
import type { AnalysisResult, HealthStatus, VerificationLevel } from "@/lib/types";
import { useI18n } from "@/lib/I18nProvider";
import {
  AlertTriangleIcon,
  BeetleIcon,
  CameraIcon,
  DropletIcon,
  InfoIcon,
  LeafIcon,
  QuestionIcon,
  SproutIcon,
  CheckIcon,
} from "./icons";

function healthMeta(health: HealthStatus): { icon: ReactNode; wrap: string } {
  switch (health) {
    case "healthy":
      return { icon: <SproutIcon size={24} />, wrap: "bg-success-light text-success" };
    case "stress":
      return { icon: <DropletIcon size={24} />, wrap: "bg-warning-light text-warning" };
    case "unhealthy":
      return { icon: <BeetleIcon size={24} />, wrap: "bg-danger-light text-danger" };
    default:
      return { icon: <QuestionIcon size={24} />, wrap: "bg-earth-light text-earth" };
  }
}

const VERIFICATION_TINT: Record<VerificationLevel, string> = {
  verified: "bg-success-light text-success",
  likely: "bg-warning-light text-warning",
  uncertain: "bg-earth-light text-earth",
};

/**
 * § Crop photo result — the farmer sees the simple answer first:
 * Crop → Health → Likely Problem → Confidence % → Why → Recommended Action →
 * Warning (only when needed) → Source. Technical/verification detail stays
 * visible but secondary. Low confidence always shows the exact "not enough
 * for a reliable diagnosis" message with which photos to send next.
 */
export default function AnalysisResultCard({
  result,
  onRetake,
  onAskMore,
}: {
  result: AnalysisResult;
  onRetake: () => void;
  onAskMore: () => void;
}) {
  const { t } = useI18n();
  const { icon, wrap } = healthMeta(result.health);
  const lowConfidence = result.confidence_pct < 40;

  return (
    <div className="flex flex-col gap-4">
      {/* Header: crop + health + confidence */}
      <section className="card" aria-label={t("photo.finding")}>
        <div className="flex items-center gap-3">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${wrap}`}>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.8rem] font-bold uppercase tracking-wide text-ink-soft">
              {t("photo.resultCrop")}
            </p>
            <h2 className="text-[1.2rem] font-extrabold leading-snug text-ink">
              {result.cropLabel ?? t("photo.cropUnknown")}
            </h2>
            <p className="text-[0.98rem] font-semibold text-ink-soft">
              {t(`photo.health.${result.health}`)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[1.5rem] font-extrabold leading-none text-ink">
              {result.confidence_pct}%
            </p>
            <p className="text-[0.8rem] font-semibold text-ink-soft">
              {t("photo.confidenceShort")}
            </p>
          </div>
        </div>

        {/* Likely problem */}
        <div className="mt-4">
          <p className="text-[0.8rem] font-bold uppercase tracking-wide text-ink-soft">
            {t("photo.resultProblem")}
          </p>
          <p className="text-[1.05rem] font-bold leading-relaxed text-ink">
            {result.likely_problem ?? t("photo.problemUnknown")}
          </p>
        </div>

        {/* Verification level */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={`chip ${VERIFICATION_TINT[result.verification]}`}>
            <InfoIcon size={15} />
            {t(`photo.verification.${result.verification}`)}
          </span>
          <span className="text-[0.82rem] font-semibold text-ink-soft">
            {result.images_analyzed > 1
              ? t("photo.imagesAnalyzed", { n: String(result.images_analyzed) })
              : null}
          </span>
        </div>
      </section>

      {/* Low-confidence banner — exact, prominent message */}
      {lowConfidence ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-warning/40 bg-warning-light p-4"
        >
          <span className="mt-0.5 shrink-0 text-warning">
            <AlertTriangleIcon size={24} />
          </span>
          <div className="flex-1">
            <p className="text-[1.02rem] font-bold leading-relaxed text-ink">
              {t("photo.lowConfidenceMsg")}
            </p>
            {result.ask_more_photos.length > 0 ? (
              <p className="mt-1 text-[0.95rem] font-semibold text-ink">
                {t("photo.sendMore")}:{" "}
                <span className="text-ink-soft">
                  {result.ask_more_photos.join(", ")}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Verification note (could not be reliably verified) */}
      {result.verification_note ? (
        <p className="flex items-start gap-2 rounded-2xl bg-earth-light/60 px-3 py-2.5 text-[0.95rem] font-medium leading-relaxed text-ink">
          <InfoIcon size={18} className="mt-0.5 shrink-0 text-earth" />
          {result.verification_note}
        </p>
      ) : null}

      {/* Why */}
      {result.why.length > 0 ? (
        <section className="card">
          <h3 className="mb-2 flex items-center gap-2 text-[1.05rem] font-extrabold text-ink">
            <QuestionIcon size={19} />
            {t("photo.resultWhy")}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {result.why.map((line, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[0.98rem] leading-relaxed text-ink"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recommended action */}
      <section className="card">
        <h3 className="mb-2.5 flex items-center gap-2 text-[1.08rem] font-extrabold text-success">
          <CheckIcon size={20} />
          {t("photo.resultAction")}
        </h3>
        <ol className="flex flex-col gap-2">
          {result.recommended_action.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-light text-[0.85rem] font-extrabold text-success">
                {i + 1}
              </span>
              <span className="text-[1rem] leading-relaxed text-ink">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Warning — only when necessary */}
      {result.warning ? (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-danger/35 bg-danger-light p-4">
          <span className="mt-0.5 shrink-0 text-danger">
            <AlertTriangleIcon size={24} />
          </span>
          <p className="text-[1rem] font-bold leading-relaxed text-ink">
            {result.warning}
          </p>
        </div>
      ) : null}

      {/* Product mentioned (label read from a packet photo) */}
      {result.product_mentioned ? (
        <p className="flex items-start gap-2 rounded-2xl bg-info-light p-3 text-[0.95rem] font-medium leading-relaxed text-ink">
          <InfoIcon size={18} className="mt-0.5 shrink-0 text-info" />
          {t("photo.productSeen", {
            name: result.product_mentioned.name,
          })}{" "}
          {t("photo.productDoseWarning")}
        </p>
      ) : null}

      {/* Plant.id disagreement */}
      {result.plantId?.used && result.plantId.agreement === "disagree" ? (
        <p className="flex items-start gap-2 rounded-2xl border border-dashed border-warning/50 bg-warning-light p-3 text-[0.95rem] font-medium leading-relaxed text-ink">
          <AlertTriangleIcon size={18} className="mt-0.5 shrink-0 text-warning" />
          {t("photo.plantIdDisagree")}
        </p>
      ) : null}

      {/* Source + disclaimer */}
      <section className="panel">
        <p className="flex items-center gap-1.5 text-[0.9rem] font-bold text-ink">
          <LeafIcon size={16} className="text-primary" />
          {t("photo.resultSource")}: {result.source}
        </p>
        <p className="mt-1.5 text-[0.88rem] font-medium leading-relaxed text-ink-soft">
          {t("photo.notGuaranteed")}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button type="button" onClick={onRetake} className="btn-secondary">
          <CameraIcon size={20} />
          {t("photo.retake")}
        </button>
        <button type="button" onClick={onAskMore} className="btn-primary">
          <QuestionIcon size={20} />
          {t("photo.askMore")}
        </button>
      </div>
    </div>
  );
}