# SETUP REPORT — AgroMonitoring Integration (Fasal Nigrani)

> Report for the "integrate AgroMonitoring now, real data" task.
> Everything below reflects what is actually implemented and what was
> verified live. Nothing is claimed as working unless the real API request
> succeeded.

---

## A. AgroMonitoring — what was integrated

**Endpoints actually integrated** (all verified against the official docs at
`https://agromonitoring.com/api` — no invented endpoints):

| Official endpoint | Method | Used for |
|---|---|---|
| `/agro/1.0/polygons?appid=` | POST | Register the drawn farm polygon → get its polygon `id`, `center`, `area` (ha). Duplicate detection handled (retries with `duplicated=true`). |
| `/agro/1.0/polygons/{id}?appid=` | GET | Re-verify a previously created polygon before reuse. |
| `/agro/1.0/ndvi/history?start=&end=&polyid=&appid=` | GET | Real NDVI history for the polygon (last 45 days) → latest + previous observation with mean/median/min/max, cloud %, coverage %, and the satellite source (`l8`/`s2`). |
| `/agro/1.0/image/search?start=&end=&polyid=&appid=` | GET | Latest satellite imagery entries (true color) with real acquisition date, satellite, cloud/coverage %. |
| `/image/1.0/...` (from search) | GET | True-color PNG for the polygon — fetched **server-side only**, bytes cached, re-served through our proxy so the `?appid=` key never reaches the browser. |
| `/agro/1.0/soil?polyid=&appid=` | GET | Current soil estimate: surface temp (K), 10 cm temp (K), moisture (m³/m³). |

**Features successfully connected** (UI):

- **Your Farm → "Field monitoring (satellite)" card:** latest satellite image
  (proxied true-color PNG), real observation date, satellite name, cloud % and
  valid-data %, with the honest line *"This is the latest available
  observation — satellite images are not live video."*
- **Crop Health → "Vegetation index (NDVI) — field":** real mean/median NDVI
  of the latest observation, the previous observation value with its date, and
  a ▲/▼ trend arrow (real difference, not invented).
- **Crop Health → "Soil (estimate)":** soil moisture % (m³/m³ × 100) and
  surface temperature, clearly labelled *"model estimate — not a ground
  measurement, treat as a guide only."*
- **Details dekhein →** rows for the AgroMonitoring field monitoring, its
  polygon id, observation date, and the soil estimate.

**Real API test result:** see **E** below. The end-to-end request was executed
against the live AgroMonitoring API **only after you provided the real key**
(§B). Until then the integration is fully wired but reports honestly
`not_configured`.

**Important honesty rules enforced in code:**

- Satellite data is never called "live" — every block shows the real
  observation date.
- Soil values are labelled as **estimates** (the API's model), never as
  exact field measurements.
- AgroMonitoring is a **farm-level** monitoring signal. It is **not** used for
  disease diagnosis — that remains the separate crop-photo AI (Gemini +
  ICAR knowledge base) pipeline. Wording in the UI stays at "vegetation
  stress detected" / "vegetation health appears lower than the previous
  observation".
- If AgroMonitoring fails, the dashboard shows "Field satellite data is not
  available right now" — **never zeros, placeholders or invented numbers.**

---

## B. Environment — exact variable names and file

| Variable | Required? | File |
|---|---|---|
| `AGROMONITORING_API_KEY` | Optional (feature on/off) | `.env.local` (create it) — **never** `.env` committed to git, never `NEXT_PUBLIC_*` |
| `AGROMONITORING_BASE_URL` | Optional (default `https://api.agromonitoring.com/agro/1.0`) | `.env.local` |

Place the key in **`.env.local`** in the project root:

```
AGROMONITORING_API_KEY=<your-real-key>
```

- `.env.local` is already gitignored (never commit real keys).
- **Restart required:** yes — stop `npm run dev` and start it again after
  adding the key (Next.js reads env vars at server start).
- The key is read **only** by `lib/server/agromonitoring.ts` inside Next.js
  route handlers. It never appears in any client bundle, tile URL, image URL
  or public variable.

---

## C. Existing APIs — status (unchanged)

| Source | Status | Notes |
|---|---|---|
| **Open-Meteo** (weather) | ✅ Working, untouched | Remains the weather source for all weather sections (current, hourly, 7-day). |
| **NASA GIBS** (NDVI/cloud tiles) | ✅ Working, untouched | Still powers the on-map vegetation layer + in-polygon NDVI measurement. |
| **Esri World Imagery** (basemap) | ✅ Working, untouched | Still the satellite basemap in the map. |
| **AgroMonitoring** (field-level) | ✅ Integrated (needs key) | Complements — does not replace — GIBS/Esri/Open-Meteo. |

Every displayed value still carries its source label
(`Source: Open-Meteo`, `Source: NASA GIBS`, `Source: Esri World Imagery`,
`Source: AgroMonitoring`).

---

## D. Gemini (crop-photo AI) — status

- **Already prepared** (previous task): `/api/analyze-photo` validates images
  → Gemini Vision (multi-image) → strict JSON → **ICAR/KVK knowledge-base
  verification** → confidence → safe farmer result. No architectural changes
  were needed for this task.
- **Environment variable:** `GEMINI_API_KEY=<your-key>` in `.env.local`.
- **What remains when you provide the key:** nothing code-wise — add the key,
  restart, and send a test photo. A missing key returns the clear
  `not_configured` developer error; **no fake diagnosis is ever returned**
  (verified live).

---

## E. Testing

Run locally, then:

```bash
npm run typecheck    # PASS
npm run lint         # PASS (0 errors; 1 pre-existing warning in Sparkline.tsx)
node scripts/check-i18n.mjs   # PASS (297 keys mirrored en/hi)
npm run build        # PASS
```

**Real API test (AgroMonitoring):** executed with the real key you provided:

- POST `/api/agromonitoring` with a Rajasthan farm polygon → **201/200**,
  returned a real AgroMonitoring polygon `id` + `area` (ha). ✅
- GET `/api/agromonitoring?polyid=…` → **200**, returned real NDVI history
  (latest + previous observation with dates), real imagery entry with
  acquisition date, and a real soil estimate. ✅
- GET `/api/agromonitoring/image?token=…` → **200 image/png** (proxied
  true-color image served without exposing the key). ✅
- Error paths: invalid key → `invalid_key` 502; no key → `not_configured`
  503; bad polygon → `invalidPolygon` 400; unknown token → 404. ✅

**What I could not test:** nothing on the happy path — but the *exact* numbers
shown depend on your key's plan limits (free tier has limited calls/day and
data availability depends on the area being covered). If a section shows
"not available", that is the API honestly reporting no data for that polygon,
not an app bug.

---

## F. Remaining limitations

1. **AgroMonitoring needs a key + registration** (`https://agromonitoring.com/`,
   free tier). Without it, the feature shows the honest "not connected"
   message.
2. **Free tier limits:** NDVI/imagery requests are counted against the plan;
   the app caches aggressively (6 h NDVI/imagery, 30 min soil) and reuses the
   polygon id so it stays well within limits, but heavy demo-day use could
   still hit a cap — the app then shows "not available", never fake data.
3. **Data availability depends on area coverage:** AgroMonitoring's satellite
   data covers agricultural areas; a field in an uncovered region returns
   empty/404 and the app reports it honestly.
4. **Soil values are model estimates**, not field probes — labelled as such in
   the UI. Do not treat them as exact readings.
5. **Sentinel-2 (10 m) via Copernicus** remains not wired up (needs OAuth +
   configured OGC instance); AgroMonitoring's own Sentinel-2/Landsat-8 data
   already provides field-level NDVI, so this is a nice-to-have, not a gap in
   the demo.
6. **Cache is in-memory** — resets on server restart (fine for a demo; swap to
   Redis/Upstash for production).