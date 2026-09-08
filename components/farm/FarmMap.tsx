"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/lib/I18nProvider";
import type { FarmPolygon, SatelliteStatus } from "@/lib/types";
import { m2ToAcres, m2ToHectares, polygonAreaM2 } from "@/lib/farmGeometry";
import {
  MapPinIcon,
  PlusIcon,
  UndoIcon,
  TrashIcon,
  CheckIcon,
} from "@/components/icons";

interface FarmMapProps {
  center: { lat: number; lon: number };
  status: SatelliteStatus | null;
  polygon: FarmPolygon | null;
  onPolygonChange: (ring: [number, number][]) => void;
  height?: number;
  /** When false the map is read-only (dashboard view) — no draw controls. */
  editable?: boolean;
}

/** Keep the map centred on the farm location whenever it changes. */
function FollowCenter({ center }: { center: { lat: number; lon: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon], Math.max(map.getZoom(), 15), {
      animate: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lon]);
  return null;
}

/** One-time flight to the farm once the map is mounted. */
function InitialFly({ center }: { center: { lat: number; lon: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lon], 15, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function FarmMap({
  center,
  status,
  polygon,
  onPolygonChange,
  height = 360,
  editable = true,
}: FarmMapProps) {
  const { t, lang } = useI18n();
  const [drawing, setDrawing] = useState(false);
  const [showNdsvi, setShowNdvi] = useState(false);
  const [showStreets, setShowStreets] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const drawingRef = useRef(false);

  const ring = useMemo(() => polygon?.ring ?? [], [polygon?.ring]);

  const areaM2 = useMemo(() => polygonAreaM2(ring), [ring]);
  const areaLine =
    areaM2 !== null && areaM2 > 0
      ? lang === "hi"
        ? `${m2ToHectares(areaM2).toFixed(2)} हेक्टेयर (${m2ToAcres(areaM2).toFixed(2)} एकड़)`
        : `${m2ToHectares(areaM2).toFixed(2)} hectares (${m2ToAcres(areaM2).toFixed(2)} acres)`
      : null;

  // NDVI tile layer URL (latest observation date).
  const ndviUrl = useMemo(() => {
    if (!status?.ndvi) return null;
    return status.ndvi.tileUrl
      .replace("{date}", status.ndvi.date)
      .replace("{z}", "{z}")
      .replace("{y}", "{y}")
      .replace("{x}", "{x}");
  }, [status]);

  const basemapUrl = status?.basemap.tileUrl ?? "";
  const basemapAttribution = status?.basemap.attribution ?? "";

  const handleMapClick = useCallback(
    (latlng: { lat: number; lng: number }) => {
      if (!drawingRef.current) return;
      const next: [number, number][] = [...ring, [latlng.lat, latlng.lng]];
      onPolygonChange(next);
    },
    [ring, onPolygonChange]
  );

  const startDrawing = () => {
    drawingRef.current = true;
    setDrawing(true);
    setTip(t("farm.drawHint"));
  };
  const stopDrawing = () => {
    drawingRef.current = false;
    setDrawing(false);
    setTip(null);
  };
  const undoPoint = () => {
    if (ring.length === 0) return;
    onPolygonChange(ring.slice(0, -1));
  };
  const clearPolygon = () => {
    drawingRef.current = false;
    setDrawing(false);
    setTip(null);
    onPolygonChange([]);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-earth/15 bg-surface shadow-[0_1px_3px_rgba(31,42,31,0.08)]">
      <div style={{ height }} className="relative z-0">
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={15}
          zoomControl
          attributionControl
          className="h-full w-full"
          style={{ background: "#dfe7df" }}
        >
          <InitialFly center={center} />
          <FollowCenter center={center} />
          <ClickCatcher onMapClick={handleMapClick} active={drawing} />
          {basemapUrl ? (
            <TileLayer url={basemapUrl} attribution={basemapAttribution} maxZoom={19} />
          ) : null}
          {showStreets ? (
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
          ) : null}
          {showNdsvi && ndviUrl && status?.ndvi ? (
            <TileLayer url={ndviUrl} opacity={0.78} maxZoom={status.ndvi.maxZoom} />
          ) : null}
          <CircleMarker
            center={[center.lat, center.lon]}
            radius={9}
            pathOptions={{ color: "#2f6b3a", fillColor: "#2f6b3a", fillOpacity: 0.9, weight: 2 }}
          />
          {ring.length > 0 ? (
            <Polygon
              positions={ring as [number, number][]}
              pathOptions={{
                color: "#b3261e",
                weight: 3,
                fillColor: "#b3261e",
                fillOpacity: 0.18,
              }}
            />
          ) : null}
          {drawing && ring.length > 0 ? (
            <VertexMarkers ring={ring} />
          ) : null}
        </MapContainer>

        {drawing ? (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-[500] flex justify-center px-3">
            <p className="pointer-events-auto rounded-full bg-ink/85 px-4 py-1.5 text-center text-[0.92rem] font-semibold text-white">
              {tip ?? t("farm.drawHint")}
            </p>
          </div>
        ) : null}

        {showNdsvi && status?.ndvi ? (
          <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-xl bg-surface/95 px-3 py-2 text-[0.8rem] leading-tight shadow">
            <p className="font-extrabold text-ink">{t("farm.ndviLegend")}</p>
            <div className="mt-1 h-2.5 w-40 rounded-full bg-gradient-to-r from-[#f5e6d8] via-[#d9c05f] to-[#1a7a3a]" />
            <p className="mt-0.5 text-ink-soft">
              {lang === "hi" ? "कम हरियाली → ज़्यादा हरियाली" : "Less green → More green"}
            </p>
          </div>
        ) : null}
      </div>

      {/* Control bar — big, tappable (only when editable) */}
      <div className="flex flex-col gap-2 border-t border-earth/10 bg-surface p-3">
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={drawing ? stopDrawing : startDrawing}
              className={`btn-primary flex-1 ${drawing ? "!bg-warning !text-white" : ""}`}
            >
              {drawing ? <CheckIcon size={20} /> : <PlusIcon size={20} />}
              {drawing ? t("farm.doneDrawing") : t("farm.selectField")}
            </button>
            {ring.length > 0 ? (
              <>
                <button type="button" onClick={undoPoint} className="btn-secondary">
                  <UndoIcon size={18} />
                  {t("farm.undo")}
                </button>
                <button
                  type="button"
                  onClick={clearPolygon}
                  className="btn-secondary !text-danger"
                >
                  <TrashIcon size={18} />
                  {t("farm.clear")}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {areaLine ? (
          <p className="rounded-2xl bg-primary-light px-3 py-2 text-center text-[0.95rem] font-bold text-primary">
            {t("farm.fieldArea")}: {areaLine}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <LayerToggle
            active={showNdsvi}
            disabled={!status?.ndvi}
            onClick={() => setShowNdvi((v) => !v)}
            label={t("farm.layerNdvi")}
          />
          <LayerToggle
            active={showStreets}
            onClick={() => setShowStreets((v) => !v)}
            label={t("farm.layerStreets")}
          />
          <span className="ml-auto inline-flex items-center gap-1 text-[0.85rem] font-semibold text-ink-soft">
            <MapPinIcon size={15} />
            {center.lat.toFixed(4)}, {center.lon.toFixed(4)}
          </span>
        </div>

        {/* Honest satellite provenance */}
        {status?.ndvi ? (
          <p className="px-1 text-[0.85rem] font-medium leading-relaxed text-ink-soft">
            {t("farm.satelliteLabel", {
              date: status.ndvi.date,
            })}
            {status.ndvi.daysAgo > 1
              ? ` ${t("farm.satelliteDaysAgo", { days: String(status.ndvi.daysAgo) })}`
              : ` ${t("farm.satelliteDaysAgoOne")}`}
            {" — "}
            {t("farm.sourceGibs")}
          </p>
        ) : (
          <p className="px-1 text-[0.85rem] font-medium leading-relaxed text-warning">
            {t("farm.satelliteUnavailable")}
          </p>
        )}
      </div>
    </div>
  );
}

function ClickCatcher({
  onMapClick,
  active,
}: {
  onMapClick: (latlng: { lat: number; lng: number }) => void;
  active: boolean;
}) {
  useMapEvents({
    click(e) {
      if (active) onMapClick(e.latlng);
    },
  });
  return null;
}

function VertexMarkers({ ring }: { ring: [number, number][] }) {
  return (
    <>
      {ring.map(([lat, lon], i) => (
        <CircleMarker
          key={`${lat}-${lon}-${i}`}
          center={[lat, lon]}
          radius={5}
          pathOptions={{ color: "#fff", fillColor: "#b3261e", fillOpacity: 1, weight: 2 }}
        />
      ))}
    </>
  );
}

function LayerToggle({
  active,
  disabled = false,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-10 cursor-pointer rounded-full px-3.5 text-[0.9rem] font-bold transition-colors ${
        active
          ? "bg-primary text-white"
          : "border border-earth/25 bg-bg text-ink hover:bg-primary-light/50"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {label}
    </button>
  );
}