"use client";

import { useCallback, useRef, useState } from "react";
import PageShell from "@/components/PageShell";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import NoticeBox from "@/components/shared/NoticeBox";
import SectionHeader from "@/components/shared/SectionHeader";
import { SourceChip } from "@/components/shared/DataChip";
import {
  CheckIcon,
  ExternalIcon,
  FlaskIcon,
  InfoIcon,
  MicroscopeIcon,
  SoilIcon,
  WarningIcon,
} from "@/components/icons";
import { useI18n } from "@/lib/I18nProvider";
import type { SoilPayload, SoilParams } from "@/lib/types";

interface Field {
  key: keyof SoilParams;
  label: string;
  unit: string;
  step: string;
  placeholder: string;
  min: number;
  max: number;
}

const FIELDS: Field[] = [
  { key: "ph", label: "pH", unit: "", step: "0.1", placeholder: "6.5", min: 0, max: 14 },
  { key: "ec", label: "EC", unit: "dS/m", step: "0.1", placeholder: "1.2", min: 0, max: 30 },
  { key: "oc", label: "OC", unit: "%", step: "0.05", placeholder: "0.5", min: 0, max: 10 },
  { key: "n", label: "N", unit: "kg/ha", step: "1", placeholder: "280", min: 0, max: 2000 },
  { key: "p", label: "P₂O₅", unit: "kg/ha", step: "1", placeholder: "22", min: 0, max: 500 },
  { key: "k", label: "K₂O", unit: "kg/ha", step: "1", placeholder: "120", min: 0, max: 1000 },
];

const defaults: SoilParams = { ph: null, ec: null, oc: null, n: null, p: null, k: null };

export default function SoilPage() {
  const { t, lang } = useI18n();
  const [values, setValues] = useState<SoilParams>(defaults);
  const [stateName, setStateName] = useState("Rajasthan");
  const [result, setResult] = useState<SoilPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  /** Builds query params inline so no helper needs to be recreated per render. */
  const analyze = useCallback(
    (p: SoilParams) => {
      const id = ++runId.current;
      setBusy(true);
      setError(null);
      const params = new URLSearchParams({
        lang,
        state: stateName,
        ph: p.ph?.toString() ?? "",
        ec: p.ec?.toString() ?? "",
        oc: p.oc?.toString() ?? "",
        n: p.n?.toString() ?? "",
        p: p.p?.toString() ?? "",
        k: p.k?.toString() ?? "",
      });
      fetch(`/api/soil?${params}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((j: SoilPayload) => {
          if (runId.current !== id) return;
          setResult(j);
          setBusy(false);
        })
        .catch(() => {
          if (runId.current !== id) return;
          setError(t("errors.network"));
          setBusy(false);
        });
    },
    [stateName, lang, t]
  );

  const anyEntered =
    values.ph !== null || values.ec !== null || values.oc !== null ||
    values.n !== null || values.p !== null || values.k !== null;

  /** Neutral (healthy) bands use the green tint; everything else amber. */
  const bandTint = (b: string) =>
    b === "neutral" || b === "high"
      ? "bg-primary-light text-primary"
      : "bg-warning-light text-warning";

  /** One soil input field with a visible label (never placeholder-only). */
  const soilField = (f: Field) => (
    <label key={f.key} className="flex flex-col gap-1">
      <span className="text-[0.85rem] font-bold text-ink-soft">
        {f.label}
        {f.unit ? <span className="text-[0.75rem]"> ({f.unit})</span> : null}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={f.min}
        max={f.max}
        step={f.step}
        placeholder={f.placeholder}
        value={values[f.key]?.toString() ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          const next = { ...values };
          next[f.key] = raw === "" ? null : Number(raw);
          setValues(next);
        }}
        className="input-base font-bold"
      />
    </label>
  );

  return (
    <PageShell title={t("soil.title")} subtitle={t("soil.subtitle")} backHref="/">
      <NoticeBox icon={<InfoIcon size={20} />} tone="info">
        {t("soil.howTo")}
      </NoticeBox>

      <section className="card-sm">
        <SectionHeader icon={<FlaskIcon size={20} />} text={t("soil.enterTitle")} hint={t("soil.enterHint")} />

        <h3 className="mt-4 text-[0.95rem] font-bold text-ink-soft">
          {t("soil.groupChemistry")}
        </h3>
        <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FIELDS.filter((f) => ["ph", "ec", "oc"].includes(f.key)).map((f) => soilField(f))}
        </div>

        <h3 className="mt-4 text-[0.95rem] font-bold text-ink-soft">
          {t("soil.groupNutrients")}
        </h3>
        <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FIELDS.filter((f) => ["n", "p", "k"].includes(f.key)).map((f) => soilField(f))}
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="field-label">{t("soil.stateLabel")}</span>
          <input
            type="text"
            value={stateName}
            onChange={(e) => setStateName(e.target.value)}
            className="input-base font-bold"
          />
        </label>
        <button
          type="button"
          className="btn-primary mt-4 w-full"
          disabled={!anyEntered}
          onClick={() => analyze(values)}
        >
          <MicroscopeIcon size={18} />
          {t("soil.analyze")}
        </button>
        {!anyEntered ? (
          <p className="mt-2 text-[0.85rem] font-semibold text-ink-soft">{t("soil.needOne")}</p>
        ) : null}
      </section>

      {busy ? <LoadingState message={t("soil.checking")} /> : null}
      {error ? <ErrorState message={error} onRetry={() => analyze(values)} /> : null}

      {result ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SourceChip source={result.source} />
            <span className="gov-src">
              <SoilIcon size={13} />
              {t("soil.sourceGov")}
            </span>
          </div>

          <NoticeBox
            icon={result.result.healthyBand ? <CheckIcon size={20} /> : <WarningIcon size={20} />}
            tone={result.result.healthyBand ? "success" : "warning"}
          >
            <span className="font-bold">{result.result.summary}</span>
          </NoticeBox>

          <h2 className="section-head">
            <FlaskIcon size={19} className="text-primary" />
            {t("soil.factorsTitle")}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.result.factors.map((f) => (
              <div key={f.param} className="card-sm flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[0.95rem] font-extrabold text-ink">
                    {f.param}
                    {f.unit ? <span className="text-[0.78rem] text-ink-soft"> ({f.unit})</span> : null}
                  </dt>
                  <dd className="text-[1.05rem] font-extrabold text-ink">
                    {f.value !== null ? f.value : "–"}
                  </dd>
                </div>
                <span className={`chip ${bandTint(f.band ?? "")}`}>{f.label}</span>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-soft">{f.note}</p>
              </div>
            ))}
          </dl>

          {result.result.suggestions.length > 0 ? (
            <>
              <h2 className="section-head">
                <CheckIcon size={19} className="text-primary" />
                {t("soil.suggestionsTitle")}
              </h2>
              <ul className="flex flex-col gap-2">
                {result.result.suggestions.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-[0.95rem] leading-relaxed text-ink">
                    <CheckIcon size={16} className="mt-0.5 shrink-0 text-primary" />
                    {s}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h2 className="section-head">
            <MicroscopeIcon size={19} className="text-primary" />
            {t("soil.labsTitle")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {result.labs.map((lab) => (
              <a
                key={lab.name}
                href={lab.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card-sm group flex items-center justify-between gap-2 transition-colors hover:border-primary/40 hover:bg-primary-light/40"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-[1rem] font-extrabold text-ink">{lab.name}</span>
                  <span className="text-[0.85rem] text-ink-soft">{lab.contact}</span>
                </span>
                <span className="text-primary">
                  <ExternalIcon size={20} />
                </span>
              </a>
            ))}
          </div>

          <NoticeBox icon={<InfoIcon size={20} />} tone="info">
            {result.note}
          </NoticeBox>
        </>
      ) : null}
    </PageShell>
  );
}