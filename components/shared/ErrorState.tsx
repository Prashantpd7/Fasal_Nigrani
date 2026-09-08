"use client";

import { WarningIcon, RefreshIcon } from "../icons";
import { useI18n } from "@/lib/I18nProvider";

interface Props {
  message: string;
  onRetry?: () => void;
}

/** Errors always explain what happened in plain words and offer a retry (§9). */
export default function ErrorState({ message, onRetry }: Props) {
  const { t } = useI18n();
  return (
    <div className="card flex flex-col items-center gap-3 border-danger/25 py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger">
        <WarningIcon size={28} />
      </span>
      <p className="max-w-md text-[1.05rem] font-semibold leading-relaxed text-ink">
        {message}
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-primary mt-1">
          <RefreshIcon size={20} />
          {t("common.retry")}
        </button>
      ) : null}
    </div>
  );
}
