"use client";

import type { ReactNode } from "react";
import type { AnalysisResult, Category } from "@/lib/types";
import { useI18n } from "@/lib/I18nProvider";
import ConfidenceBadge from "./ConfidenceBadge";
import {
  AlertTriangleIcon,
  BeetleIcon,
  BoltIcon,
  CameraIcon,
  DropletIcon,
  InfoIcon,
  LeafIcon,
  QuestionIcon,
  SproutIcon,
  CheckIcon,
  XIcon,
} from "./icons";

function categoryIcon(category: Category): {
  icon: ReactNode;
  wrap: string;
} {
  switch (category) {
    case "disease":
      return { icon: <LeafIcon size={26} />, wrap: "bg-warning-light text-warning" };
    case "pest_damage":
      return { icon: <BeetleIcon size={26} />, wrap: "bg-earth-light text-earth" };
    case "water_stress":
      return { icon: <DropletIcon size={26} />, wrap: "bg-info-light text-info" };
    case "nutrient_deficiency":
      return { icon: <SproutIcon size={26} />, wrap: "bg-warning-light text-warning" };
    case "physical_damage":
      return { icon: <BoltIcon size={26} />, wrap: "bg-earth-light text-earth" };
    case "looks_healthy":
      return { icon: <SproutIcon size={26} />, wrap: "bg-success-light text-success" };
    default:
      return { icon: <QuestionIcon size={26} />, wrap: "bg-earth-light text-earth" };
  }
}

/** §13 AnalysisResultCard: one-line finding first, then confidence badge,
 *  explanation, numbered "do" steps, an "avoid" box, and — when needed — a
 *  clearly visible expert prompt that is never hidden behind a scroll. */
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
  const { icon, wrap } = categoryIcon(result.likely_category);
  const categoryLabel = t(`photo.categories.${result.likely_category}`);

  return (
    <div className="flex flex-col gap-4">
      {/* 1 — one-line finding */}
      <section className="card" aria-label={t("photo.finding")}>
        <div className="flex items-center gap-3">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${wrap}`}>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.18rem] font-extrabold leading-snug text-ink">
              {categoryLabel}
            </h2>
            {result.possible_specific_issue ? (
              <p className="text-[0.98rem] font-semibold text-ink-soft">
                {result.possible_specific_issue}
              </p>
            ) : null}
          </div>
          <ConfidenceBadge level={result.confidence} />
        </div>

        <p className="mt-4 text-[1.02rem] leading-relaxed text-ink">
          {result.explanation_simple}
        </p>
      </section>

      {/* 2 — expert prompt (red, prominent, not below the fold) */}
      {result.seek_expert_advice ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-danger/35 bg-danger-light p-4"
        >
          <span className="mt-0.5 shrink-0 text-danger">
            <AlertTriangleIcon size={24} />
          </span>
          <p className="text-[1.02rem] font-bold leading-relaxed text-ink">
            {t("photo.seekExpert")}
          </p>
        </div>
      ) : null}

      {/* 3 — what to do now */}
      {result.what_to_do_now.length > 0 ? (
        <section className="card">
          <h3 className="mb-2.5 flex items-center gap-2 text-[1.08rem] font-extrabold text-success">
            <CheckIcon size={20} />
            {t("photo.doNowTitle")}
          </h3>
          <ol className="flex flex-col gap-2">
            {result.what_to_do_now.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-light text-[0.85rem] font-extrabold text-success">
                  {i + 1}
                </span>
                <span className="text-[1rem] leading-relaxed text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* 4 — avoid box, distinctly styled */}
      {result.what_to_avoid.length > 0 ? (
        <section className="rounded-2xl border border-dashed border-danger/40 bg-surface p-4">
          <h3 className="mb-2 flex items-center gap-2 text-[1.02rem] font-extrabold text-danger">
            <XIcon size={18} />
            {t("photo.avoidTitle")}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {result.what_to_avoid.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[0.98rem] leading-relaxed text-ink"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 5 — better photo tip + next actions */}
      {result.better_photo_tip ? (
        <p className="flex items-start gap-2 rounded-2xl bg-info-light p-3 text-[0.95rem] font-medium leading-relaxed text-ink">
          <InfoIcon size={18} className="mt-0.5 shrink-0 text-info" />
          {t("photo.betterPhotoTip", { tip: result.better_photo_tip })}
        </p>
      ) : null}

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
