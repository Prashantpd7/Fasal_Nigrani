"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import CameraCapture from "@/components/CameraCapture";
import AnalysisResultCard from "@/components/AnalysisResultCard";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { CameraIcon, WarningIcon } from "@/components/icons";
import { useI18n } from "@/lib/I18nProvider";
import {
  assessQuality,
  prepareImage,
  fileTooLarge,
  type QualityIssue,
} from "@/lib/clientImage";
import { cachePhotoContext } from "@/lib/clientStore";
import type { AnalysisResult } from "@/lib/types";

type View = "idle" | "busy" | "result" | "error";

const qualityKey: Record<QualityIssue, string> = {
  too_dark: "photo.quality.tooDark",
  too_blurry: "photo.quality.tooBlurry",
  ok: "photo.quality.generic",
};

/**
 * Flow B (§8): camera capture (camera-first, gallery fallback) → client-side
 * quality pre-check BEFORE any API spend → server vision analysis via the
 * strict JSON contract → result card with confidence + expert flag.
 */
export default function PhotoCheckPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [view, setView] = useState<View>("idle");
  const [busyMsg, setBusyMsg] = useState("");
  const [qualityNotice, setQualityNotice] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [captureKey, setCaptureKey] = useState(0);
  const lastFileRef = useRef<File | null>(null);

  const reset = useCallback(() => {
    setView("idle");
    setQualityNotice(null);
    setResult(null);
    setErrorMsg(null);
    setCaptureKey((k) => k + 1);
    lastFileRef.current = null;
  }, []);

  const runAnalysis = useCallback(
    async (file: File, skipQualityCheck: boolean) => {
      lastFileRef.current = file;
      if (fileTooLarge(file)) {
        setErrorMsg(t("photo.imageTooBig"));
        setView("error");
        return;
      }

      if (!skipQualityCheck) {
        setBusyMsg(t("photo.analyzing"));
        setView("busy");
        let issue: QualityIssue;
        try {
          issue = await assessQuality(file);
        } catch {
          issue = "ok";
        }
        if (issue !== "ok") {
          setQualityNotice(t(qualityKey[issue]));
          setView("idle");
          return;
        }
      }

      setBusyMsg(t("photo.analyzing"));
      setView("busy");
      try {
        const prepared = await prepareImage(file);
        const res = await fetch("/api/analyze-photo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            image: prepared.base64,
            mime: prepared.mime,
            lang,
          }),
        });
        const data = (await res.json().catch(() => null)) as AnalysisResult | null;
        if (!res.ok || !data || typeof data.likely_category !== "string") {
          if (res.status === 429) setErrorMsg(t("errors.rateLimited"));
          else if (res.status === 413) setErrorMsg(t("photo.imageTooBig"));
          else setErrorMsg(t("errors.network"));
          setView("error");
          return;
        }
        const summary = data.explanation_simple
          ? `${data.likely_category}: ${data.explanation_simple}`
          : data.likely_category;
        cachePhotoContext({
          summary: summary.slice(0, 200),
          at: Date.now(),
          lang,
        });
        setResult(data);
        setView("result");
      } catch {
        setErrorMsg(t("errors.network"));
        setView("error");
      }
    },
    [lang, t]
  );

  return (
    <PageShell
      title={t("photo.title")}
      subtitle={t("photo.subtitle")}
      backHref="/"
    >
      {view === "busy" ? (
        <LoadingState message={busyMsg} detail={t("photo.analyzingDetail")} />
      ) : null}

      {view === "error" ? (
        <ErrorState
          message={errorMsg ?? t("errors.network")}
          onRetry={() => {
            setView("busy");
            if (lastFileRef.current) void runAnalysis(lastFileRef.current, true);
            else reset();
          }}
        />
      ) : null}

      {view === "result" && result ? (
        <>
          {result.demo ? (
            <p className="rounded-2xl border border-dashed border-warning/40 bg-warning-light px-3 py-2 text-center text-[0.9rem] font-bold text-warning">
              {t("analysis.demoTitle")}
            </p>
          ) : null}
          <AnalysisResultCard
            result={result}
            onRetake={reset}
            onAskMore={() => router.push("/chat")}
          />
        </>
      ) : null}

      {view === "idle" ? (
        <>
          {qualityNotice ? (
            <div className="flex items-start gap-3 rounded-2xl border-2 border-warning/35 bg-warning-light p-4">
              <span className="mt-0.5 shrink-0 text-warning">
                <WarningIcon size={24} />
              </span>
              <div className="flex-1">
                <p className="text-[1.02rem] font-bold leading-relaxed text-ink">
                  {qualityNotice}
                </p>
                <button type="button" onClick={reset} className="btn-primary mt-3 w-full">
                  <CameraIcon size={20} />
                  {t("photo.retake")}
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl bg-primary-light px-4 py-3 text-center text-[0.95rem] font-semibold leading-relaxed text-ink">
              {t("photo.emptyDesc")}
            </p>
          )}
          <CameraCapture
            key={captureKey}
            onFile={(f) => void runAnalysis(f, false)}
          />
        </>
      ) : null}
    </PageShell>
  );
}
