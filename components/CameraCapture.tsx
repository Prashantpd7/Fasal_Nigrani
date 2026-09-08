"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/I18nProvider";
import { CameraIcon, ImageIcon, XIcon } from "./icons";

/**
 * §13 CameraCapture: wraps camera input (`capture="environment"` opens the
 * rear camera directly on phones) + a gallery upload fallback + preview +
 * retake. The actual quality pre-check happens in the parent before the API
 * call (§8 Flow B).
 */
export default function CameraCapture({
  onFile,
  disabled = false,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setBusy(true);
    // Give the UI a beat to paint the preview before heavy work starts.
    setTimeout(() => {
      setBusy(false);
      onFile(file);
    }, 60);
  };

  return (
    <div className="card">
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={t("photo.photoAlt")}
            className="max-h-80 w-full rounded-2xl border border-earth/15 object-cover"
          />
          <button
            type="button"
            aria-label={t("photo.retake")}
            onClick={() => {
              setPreview(null);
              if (cameraRef.current) cameraRef.current.value = "";
              if (galleryRef.current) galleryRef.current.value = "";
            }}
            className="absolute right-2.5 top-2.5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-ink/70 text-white backdrop-blur"
          >
            <XIcon size={20} />
          </button>
          {busy ? (
            <p className="attention-pulse mt-2 text-center text-[0.95rem] font-bold text-primary">
              {t("photo.captured")}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
            className="btn-primary"
          >
            <CameraIcon size={22} />
            {t("photo.takeCamera")}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => galleryRef.current?.click()}
            className="btn-secondary"
          >
            <ImageIcon size={22} />
            {t("photo.chooseGallery")}
          </button>
        </div>
      )}

      {/* Camera-first on mobile; gallery always available as fallback. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
