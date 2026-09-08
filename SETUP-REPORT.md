# Fasal Nigrani — Final Setup Report (Weather & Crop Advice upgrade)

**Date:** September 8, 2026 · **Status:** real weather + real satellite imagery
+ real NDVI vegetation monitoring are working with **zero paid services and
zero required API keys**. Read this whole file before the demo.

---

## 1. Which APIs/services I implemented

| Service | What it provides | Used for |
|---|---|---|
| **Open-Meteo** (free, no key) | Current + hourly + 7-day weather | Weather Today, 7-day forecast, rain chance/mm, wind, humidity, clouds, feels-like |
| **Esri World Imagery** (free, no key) | Global satellite basemap tiles | The map the farmer zooms into and draws their field on |
| **NASA GIBS / EOSDIS** (free, no key) | VIIRS/MODIS vegetation index (NDVI) WMTS + MODIS cloud-fraction | The "Vegetation (NDVI)" layer, crop-health indicator, cloud coverage, observation dates |

All three are wired through the app's service layer (`lib/server/weatherService.ts`,
`lib/server/satelliteService.ts`) and API routes (`/api/weather`,
`/api/satellite/status`). The browser reads real GIBS tiles directly (GIBS
sends `Access-Control-Allow-Origin: *`) and decodes NDVI values with NASA's
official colormaps — there is no mock layer anywhere in this feature.

## 2. Which are completely free

All three above are free and open:
- Open-Meteo — free, no account, no key.
- Esri World Imagery — free tile service (standard attribution), no key.
- NASA GIBS — free, no account, no key (NASA open-data policy).

## 3. Which require registration

- **Copernicus Data Space (Sentinel-2, 10 m) — NOT used.** It would give
  sharper imagery than GIBS, but needs a free account, OAuth client
  credentials, *and* a manually configured OGC/WMTS instance. It is reported
  honestly as "Not connected" in the app (Details section).
- **ISRO/MOSDAC — NOT used.** MOSDAC requires an ISRO registration and its
  public APIs don't offer a practical free WMTS/NDVI tile feed for a web map
  (products are mostly downloads/portals). Env placeholder exists only.
- **AI provider (photo-check/chat)** — unchanged from before: Anthropic or
  OpenAI key optional; without it those two features run in clearly-labelled
  demo mode. The new farm dashboard needs NO AI key.

## 4. Which require API keys/tokens

**None for the new Weather & Crop Advice feature.** Open-Meteo, Esri and NASA
GIBS are keyless. If you add an AI key later it is only for photo-check/chat.

## 5. Environment variables to create

Copy `.env.example` to `.env`. For the new feature **you do not need to set
anything** — these are the optional placeholders:

```
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1/forecast   # optional mirror
SATELLITE_API_URL=https://gibs.earthdata.nasa.gov            # optional mirror
COPERNICUS_CLIENT_ID=                                        # not implemented
COPERNICUS_CLIENT_SECRET=                                    # not implemented
MOSDAC_API_KEY=                                              # not used
```

Plus the pre-existing optional AI vars (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`)
if you want real photo analysis and chat.

## 6. Where to paste your friend's API credentials

- **Copernicus (Sentinel-2):** there is nowhere to paste them yet — the
  Sentinel-2 OGC proxy is deliberately not implemented (it needs a configured
  CDSE OGC instance, not just client-id/secret). When it is added, credentials
  go into `.env` as `COPERNICUS_CLIENT_ID` / `COPERNICUS_CLIENT_SECRET`
  (server-side only, never in frontend code).
- **AI keys (if your friend provides them):** `.env` → `ANTHROPIC_API_KEY` or
  `OPENAI_API_KEY`. They are read only in API routes, never shipped to the
  browser.

## 7. Which APIs are still missing

- **Copernicus Sentinel-2 (10 m) imagery** — the one genuinely valuable
  upgrade; needs registration + a configured OGC instance (see §3/§6).
- **ISRO/MOSDAC** — not practical as a free tile API for this use case.
- **Exact soil moisture** — no free satellite API measures field-level soil
  moisture reliably; the app honestly says so and uses weather + NDVI proxies.

## 8. Which satellite source is used

**NASA GIBS (EOSDIS)** for vegetation/cloud data, **Esri World Imagery** for
the base satellite map. Primary NDVI product: **VIIRS S-NPP NDVI 8-day**
(~375 m), with MODIS 16-day as automatic fallback. Cloud: MODIS Terra daily
cloud fraction. (All free, keyless, scientifically real.)

## 9. How satellite imagery is obtained

- The map is a standard slippy map (Leaflet) over Esri World Imagery XYZ
  tiles — the farmer sees real current satellite photography of their area.
- GIBS WMTS serves the NDVI and cloud layers as map tiles in Web Mercator, so
  they overlay perfectly. `/api/satellite/status` reads NASA's capabilities
  file (cached 6 h) and returns the **real latest observation date**, the
  previous composite date, tile URL template and colormap URL.
- The browser downloads only the tiles that intersect the farm polygon and
  averages pixels strictly inside the drawn field — never the whole map, and
  never repeatedly on pan/zoom (measurement runs only when the field is
  finalised or the user hits refresh).

## 10. How NDVI / vegetation health is calculated

1. GIBS NDVI tiles are colormapped PNGs. NASA publishes the exact colormap
   (`MODIS_NDVI.xml`), which maps every colour to an NDVI interval (0–1).
2. The client decodes each pixel's colour back to an NDVI value using that
   official colormap, skipping transparent/no-data and cloud-masked pixels.
3. It averages NDVI over the farm polygon → **mean NDVI** (a satellite
   measurement, not an estimate).
4. It repeats this for the **previous composite** (8 days earlier) → NDVI
   trend (improving / stable / declining).
5. Crop health status thresholds: ≥0.50 healthy green, 0.30–0.50 moderate
   (watch), <0.30 low greenness (possible stress), <20 valid pixels = "no
   reliable assessment". The UI always labels this "satellite-derived
   indicator", never a diagnosis, and lists possible reasons (water, weather,
   pest/disease, nutrients) instead of picking one.

## 11. What data is real vs AI-derived

| Data shown | Real? |
|---|---|
| Temperature, feels-like, humidity, wind, clouds, rain chance/mm | ✅ Real (Open-Meteo) |
| 7-day forecast | ✅ Real forecast (Open-Meteo model) |
| Satellite basemap imagery | ✅ Real (Esri World Imagery) |
| Observation date, "X days ago", cloud fraction | ✅ Real (NASA GIBS) |
| Mean NDVI + trend over your field | ✅ Real satellite measurement (GIBS tiles + official colormap) |
| Crop-health status (Healthy/Watch/Stress/Insufficient) | ⚠️ Satellite-derived interpretation of real NDVI — hedged |
| "Rain ki sambhavna zyada hai…", actions, warnings | ⚠️ Rules-engine interpretation of the real numbers above — hedged, no LLM, no invented values |
| Disease/pest diagnosis | ❌ NOT done here (that stays in Check a Crop Photo, which needs an AI key) |

The app never pretends satellite imagery is live: it shows "Latest satellite
observation: {date}" and "Latest clear satellite image available: X days ago."

## 12. Limitations remaining

- **Resolution:** GIBS NDVI is ~375 m; a small field is only a few pixels.
  It is a field-level health proxy, not per-plant.
- **Revisit lag:** VIIRS NDVI composites are ~8 days old; MODIS ~16 days.
  Cloud cover can push this further — the app says so honestly.
- **Soil moisture:** not measurable from these satellites; shown as an honest
  note, and advice is based on weather + vegetation proxies.
- **Sentinel-2 10 m imagery:** not connected (needs Copernicus registration).
- **Polygon area:** shoelace estimate on Web Mercator, accurate to a few %.
- **No persistence on the server:** farm polygon/weather cache lives in the
  browser's localStorage (survives reloads on the same phone).
- In-memory rate limits reset on server restart (fine for a hackathon).

## 13. Exact commands to run

```bash
npm install                 # if not already done
cp .env.example .env        # optional — no keys required for this feature
npm run dev                 # http://localhost:3000
# or production:
npm run build && npm start
```

Verification commands:

```bash
npm run typecheck
npm run lint
node scripts/check-i18n.mjs   # en/hi translations mirror each other
```

## 14. Manual steps still needed

- **None required** for the new feature to work live.
- Optional: register free at **Copernicus Data Space** if you later want the
  Sentinel-2 upgrade (not needed for the demo).
- Optional: add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to `.env` for real
  photo-check/chat (without them those pages show labelled demo data).

## 15. What to test before the hackathon demo

1. **Location:** open `/weather`, allow location on your phone → marker lands
   near you; deny it → district list still works.
2. **Field:** tap "Select my field", drop ≥3 points around a visible field on
   the satellite map, check the area line (ha/acres), undo/clear, redo.
3. **Crop:** pick a crop; dashboard opens.
4. **Real weather:** Weather Today + 7-day strip show numbers; check the
   "Source: Open-Meteo" + updated time.
5. **Real satellite:** Your Farm map shows real imagery; toggle the
   Vegetation (NDVI) layer — green/amber/red vegetation colours + legend.
   Note the "Latest satellite observation" date and the "X days ago" line —
   this honesty is a selling point.
6. **Crop health:** status chip + mean NDVI + trend arrow; with a desert
   location (e.g. Barmer) expect low greenness; with a green area expect
   healthy — the numbers must change with location (proof it's real).
7. **Insights:** at least one action + warning should fire from real data
   (rain/wind/heat/dry); read them aloud — they are hedged, no brand/dose.
8. **Failure honesty:** turn off wifi, hit refresh → app shows "Data abhi
   available nahi hai" / stale chips — it never invents numbers.
9. **i18n:** switch हिं/EN — every section flips language; no raw keys.
10. **Other features intact:** photo-check and chat still work as before.

---

*The one headline to remember: everything the farmer sees on the new dashboard
is either a direct measurement (Open-Meteo / Esri / NASA GIBS) or a clearly
labelled, rule-based interpretation of that measurement. Nothing is faked.*