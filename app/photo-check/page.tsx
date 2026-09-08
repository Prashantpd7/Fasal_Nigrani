"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import CameraCapture from "@/components/CameraCapture";
import AnalysisResultCard from "@/components/AnalysisResultCard";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import NoticeBox from "@/components/shared/NoticeBox";
import { ImageIcon, InfoIcon, XIcon } from "@/components/icons";
import { useI18n } from "@/lib/I18nProvider";
import {
  assessQuality,
  prepareImage,
  fileTooLarge,
  type PreparedImage,
} from "@/lib/clientImage";
import { cachePhotoContext, readCachedFarmState } from "@/lib/clientStore";
import type { AnalysisResult } from "@/lib/types";

type View = "idle" | "busy" | "result" | "error" | "notConfigured";

interface PendingPhoto {
  id: number;
  preview: string;
  prepared: PreparedImage | null;
  bad: boolean;
  file: File;
}

const MAX_PHOTOS = 4;

/**
 * Crop photo analysis (§ Photo — real AI). Multi-photo: the farmer can add up
 * to 4 photos (leaf close-up, stem, fruit, whole plant…) which are all sent
 * together and analysed as one. Every photo is validated (type/size) and
 * quality-checked client-side BEFORE any API spend. There is NO demo fallback:
 * if no AI key is configured the page shows a clear configuration notice for
 * developers and an honest note for the farmer.
 */
export default function PhotoCheckPage({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [view, setView] = useState<View>("idle");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [busyMsg, setBusyMsg] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [captureKey, setCaptureKey] = useState(0);
  const nextId = useRef(0);

  const addPhoto = useCallback(
    async (file: File) => {
      setView("idle");
      setErrorMsg(null);
      if (fileTooLarge(file)) {
        setErrorMsg(t("photo.imageTooBig"));
        setView("error");
        return;
      }
      if (photos.length >= MAX_PHOTOS) {
        setErrorMsg(t("photo.tooManyPhotos", { n: String(MAX_PHOTOS) }));
        setView("error");
        return;
      }

      const id = nextId.current++;
      const preview = URL.createObjectURL(file);
      let bad = false;
      try {
        const issue = await assessQuality(file);
        bad = issue !== "ok";
      } catch {
        bad = false; // quality check is best-effort; never block on a bug
      }
      let prepared: PreparedImage | null = null;
      try {
        prepared = await prepareImage(file);
      } catch {
        prepared = null;
      }
      setPhotos((prev) => [...prev, { id, preview, prepared, bad, file }]);
      setCaptureKey((k) => k + 1);
    },
    [photos.length, t]
  );

  const removePhoto = useCallback((id: number) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const reset = useCallback(() => {
    setView("idle");
    setResult(null);
    setErrorMsg(null);
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setCaptureKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAnalysis = useCallback(async () => {
    const okPhotos = photos.filter((p) => p.prepared && !p.bad);
    if (okPhotos.length === 0) {
      setErrorMsg(t("photo.chooseFirst"));
      setView("error");
      return;
    }
    setBusyMsg(t("photo.analyzing"));
    setView("busy");
    try {
      const farm = readCachedFarmState();
      const res = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          images: okPhotos.map((p) => ({
            image: p.prepared!.base64,
            mime: p.prepared!.mime,
          })),
          lang,
          lat: farm?.lat ?? null,
          lon: farm?.lon ?? null,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (AnalysisResult & { error?: string; message?: string })
        | null;

      if (res.status === 503 && data?.error === "not_configured") {
        setView("notConfigured");
        return;
      }
      if (!res.ok || !data || typeof data.confidence_pct !== "number") {
        if (res.status === 429) setErrorMsg(t("errors.rateLimited"));
        else if (res.status === 413) setErrorMsg(t("photo.imageTooBig"));
        else if (data?.error === "tooManyImages") {
          setErrorMsg(t("photo.tooManyPhotos", { n: String(MAX_PHOTOS) }));
        } else if (data?.message) setErrorMsg(data.message);
        else setErrorMsg(t("errors.network"));
        setView("error");
        return;
      }

      const summary = data.explanation_simple
        ? data.explanation_simple
        : data.likely_problem ?? t("photo.problemUnknown");
      cachePhotoContext({
        summary: summary.slice(0, 300),
        at: Date.now(),
        lang,
        crop: data.crop ?? null,
        problem: data.likely_problem ?? null,
        confidencePct: data.confidence_pct,
        source: data.source ?? null,
        location: farm?.label ?? null,
      });
      setResult(data);
      setView("result");
    } catch {
      setErrorMsg(t("errors.network"));
      setView("error");
    }
  }, [photos, lang, t]);

  const canAnalyze =
    photos.some((p) => p.prepared && !p.bad) && view === "idle";

  return (
    <PageShell
      embedded={embedded}
      title={t("photo.title")}
      subtitle={t("photo.subtitle")}
    >
      {view === "busy" ? (
        <LoadingState message={busyMsg} detail={t("photo.analyzingDetail")} />
      ) : null}

      {view === "error" ? (
        <ErrorState
          message={errorMsg ?? t("errors.network")}
          onRetry={() => {
            setView("busy");
            void runAnalysis();
          }}
        />
      ) : null}

      {view === "notConfigured" ? (
        <div className="card-sm flex flex-col gap-3">
          <NoticeBox icon={<InfoIcon size={22} />} tone="warning">
            <h2 className="text-[1.05rem] font-extrabold text-ink">
              {t("photo.notConfiguredTitle")}
            </h2>
            <p className="mt-1 text-[0.95rem] font-medium leading-relaxed text-ink">
              {t("photo.notConfiguredFarmer")}
            </p>
          </NoticeBox>
          <p className="panel font-mono text-[0.85rem] leading-relaxed text-ink">
            {t("photo.notConfiguredDev")}
          </p>
          <button type="button" className="btn-secondary w-full" onClick={reset}>
            {t("photo.retake")}
          </button>
        </div>
      ) : null}

      {view === "result" && result ? (
        <>
          <AnalysisResultCard
            result={result}
            onRetake={reset}
            onAskMore={() => router.push("/chat")}
          />
        </>
      ) : null}

      {view === "idle" ? (
        <>
          <p className="rounded-2xl bg-primary-light px-4 py-3 text-[0.95rem] font-semibold leading-relaxed text-ink">
            {t("photo.emptyDesc")}
          </p>

          {/* Added photos */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className={`relative overflow-hidden rounded-2xl border-2 ${
                    p.bad ? "border-warning" : "border-earth/15"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.preview}
                    alt={t("photo.photoAlt")}
                    className="h-28 w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label={t("photo.removePhoto")}
                    onClick={() => removePhoto(p.id)}
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-ink/70 text-white"
                  >
                    <XIcon size={16} />
                  </button>
                  {p.bad ? (
                    <p className="absolute inset-x-0 bottom-0 bg-warning/90 px-2 py-1 text-[0.75rem] font-bold text-white">
                      {t("photo.qualityTooPoor")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {photos.length < MAX_PHOTOS ? (
            <CameraCapture key={captureKey} onFile={(f) => void addPhoto(f)} />
          ) : (
            <p className="rounded-2xl bg-bg px-3 py-2 text-center text-[0.9rem] font-semibold text-ink-soft">
              {t("photo.maxPhotosReached", { n: String(MAX_PHOTOS) })}
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={!canAnalyze}
              className="btn-primary w-full"
              onClick={() => void runAnalysis()}
            >
              <ImageIcon size={20} />
              {photos.length > 0
                ? t("photo.analyzePhotos", { n: String(photos.filter((p) => p.prepared && !p.bad).length) })
                : t("photo.analyzePhotos", { n: "0" })}
            </button>
            {photos.some((p) => p.bad) ? (
              <p className="flex items-start gap-2 rounded-2xl bg-warning-light px-3 py-2 text-[0.9rem] font-semibold leading-relaxed text-warning">
                <InfoIcon size={18} className="mt-0.5 shrink-0" />
                {t("photo.badPhotoNotice")}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </PageShell>
  );
}