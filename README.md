# Fasal Nigrani (फसल निगरानी)

**"Your crop's watchful eye" — a mobile-first farmer companion that answers one
question at any moment: *What is happening to my farm, and what should I do
next?***

Fasal Nigrani translates **live weather data** and a **crop photo** into short,
plain-language, Hindi/English guidance the way a trusted extension worker
would — instantly, in the farmer's pocket, with no call queue. It is a
**decision-support companion**, not a replacement for agricultural experts, and
it says so honestly whenever it is uncertain.

> Built as a hackathon-ready MVP grounded in Rajasthan Kisan Call Centre data
> 2009–2023 (weather queries were the single largest category of ~4M calls).

---

## Quickstart

```bash
npm install
npm run dev          # http://localhost:3000
```

No API keys are required to run: without a key the app automatically serves
**demo mode** for photo-check and chat, and live weather comes free from
Open-Meteo (no key). The whole app can run offline/demo-only by setting
`DEMO_MODE=true` (see `.env.example`).

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build
node scripts/check-i18n.mjs   # verifies hi.json/en.json mirror each other + all code keys exist
```

---

## Features

1. **Weather & Crop Advice** (`/weather`) — now a real farm monitoring
   dashboard: geolocation or district pick → draw your field on a satellite
   map (Leaflet + Esri World Imagery) → choose your crop → dashboard with
   **real** current + hourly + 7-day Open-Meteo data (temp, feels-like, rain
   chance, rain mm, wind, humidity, clouds), a **real** NASA GIBS
   vegetation-health layer (VIIRS/MODIS NDVI decoded from actual satellite
   tiles, with observation date, "X days ago" honesty and cloud coverage),
   and   a deterministic rules engine that combines weather + NDVI + crop into
   hedged insights, ≤3 actions and colour-coded warnings. With an optional
   **AgroMonitoring** key, the drawn field is registered with OpenWeather's
   agro API and the dashboard adds **real** field-level NDVI history (with
   observation date + trend vs the previous observation), the latest
   satellite image and a soil moisture/temperature **estimate** for the exact
   polygon. No fabricated values: every number traces to Open-Meteo, NASA
   GIBS or AgroMonitoring, and failures show "data abhi available nahi hai"
   instead of fake data. Technical details sit under "Details dekhein".
2. **Crop Photo Check** (`/photo-check`) — **real AI analysis with no fake
   results**: capture up to **4 photos** (leaf, stem, fruit, whole plant) from
   camera or gallery, client-side dark/blur/size checks before any API spend,
   then **Google Gemini Vision** (default; Claude/GPT-4o also supported)
   analyses all photos together against a **strict JSON contract**. The result
   is then **verified against a trusted ICAR/KVK knowledge base** — the LLM
   never invents disease names, management steps, brands or doses. Output:
   crop, health, likely problem, **confidence %**, why, recommended action,
   warning, source, verification level (verified/likely/needs verification),
   low-confidence "send a clearer photo" guidance, and an optional **Plant.id**
   second signal (never truth). Without an AI key the page shows a clear
   "not connected" developer/config message — it never pretends to work.
   Photos are resized client-side and never stored.
3. **Ask a Question** (`/chat`) — typed or **spoken** (Web Speech API, graceful
   fallback) questions answered in ≤~80 words with the farmer's weather and
   latest photo-check attached as context (crop + problem + confidence). The
   farmer can also **attach a photo right in chat** (same real analysis
   pipeline) and ask follow-ups about it, and tap **"Get a short summary"** to
   receive the compact end-of-conversation recap (Crop / Problem / Confidence /
   Recommendation / Product discussed / Warning / Source).

Non-MVP modules (mandi prices, soil testing, schemes…) appear as disabled
"coming soon" chips only.

**Safety by design:** no pesticide brands/doses ever; low confidence always
recommends a Krishi Vigyan Kendra or expert; red is reserved for real urgency;
everything farmer-facing is in simple Hindi (Devanagari) or English.

---

## Configuration

Copy `.env.example` to `.env`. Options:

| Var | Purpose |
|---|---|
| `DEMO_MODE=true/false` | `true` = all sample data (weather/photo/chat), `false` = force live, unset = auto |
| `ANTHROPIC_API_KEY` | Vision + chat via Claude (recommended) |
| `ANTHROPIC_MODEL` | Default `claude-sonnet-4-5` |
| `OPENAI_API_KEY` | Vision + chat via OpenAI |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible endpoint |
| `GEMINI_API_KEY` | **Photo analysis + chat via Google Gemini** (preferred; provider order Gemini → Anthropic → OpenAI) |
| `GEMINI_MODEL` | Default `gemini-2.5-flash` |
| `PLANT_ID_API_KEY` / `PLANT_ID_API_URL` | Optional Plant.id second signal (paid; never required) |
| `OPEN_METEO_BASE_URL` | Optional Open-Meteo mirror/proxy (default: free public endpoint) |
| `SATELLITE_API_URL` | Optional NASA GIBS mirror/proxy (default: free public endpoint) |
| `COPERNICUS_CLIENT_ID` / `COPERNICUS_CLIENT_SECRET` | Placeholders — Sentinel-2 (10 m) is **not** wired up yet; see SETUP-REPORT.md |
| `MOSDAC_API_KEY` | Placeholder — ISRO/MOSDAC is not used (no practical free WMTS/NDVI API) |
| `AGROMONITORING_API_KEY` | Optional **field-level monitoring** (NDVI history, satellite image, soil estimate for the drawn polygon). Server-side only — never sent to the browser. Without it the dashboard shows an honest "not connected" message. See **SETUP-REPORT-AGRO.md** |
| `AGROMONITORING_BASE_URL` | Optional AgroMonitoring mirror/proxy (default `https://api.agromonitoring.com/agro/1.0`) |

Keys are read **server-side only** (Next.js API routes) — never shipped to the
browser. `/api/analyze-photo`, `/api/chat` and `/api/satellite/status` are
rate-limited per IP (in-memory) to protect a demo day.

**Photo analysis honesty rules:** no demo fallback — a missing AI key returns
`503 not_configured` with developer guidance; the LLM only suggests conditions
which the ICAR/KVK knowledge layer (`lib/server/agricultureKnowledge.ts`)
verifies; no brands/doses ever; low confidence shows the exact
"not sufficient for a reliable diagnosis" message; Plant.id (when configured)
is compared and disagreements are flagged as "verification required".
See **SETUP-REPORT-PHOTO.md** for the full breakdown.

**Weather & satellite sources (real, free, no key):**

- **Weather:** Open-Meteo (`/api/weather`) — current + hourly + 7-day.
- **Satellite imagery basemap:** Esri World Imagery tiles (Leaflet).
- **Vegetation health:** NASA GIBS VIIRS/MODIS NDVI WMTS (`/api/satellite/status`
  returns layer config + real observation dates; the browser decodes the tiles
  with the official GIBS colormaps and averages NDVI inside the farm polygon).
- **Cloud coverage:** NASA GIBS MODIS cloud fraction over the field.
- **Field-level monitoring (optional):** AgroMonitoring (`/api/agromonitoring`)
  — real per-polygon NDVI history with observation dates + trend, latest
  satellite image, and a soil moisture/temperature **estimate** (model, not a
  field probe — clearly labelled). The key stays server-side; images are
  re-served through our own proxy so `?appid=` never reaches the browser.

Nothing here is simulated: if a source is unreachable the UI says so honestly.
See **SETUP-REPORT.md** for the full breakdown (what is real vs derived, what
still needs registration, and what to test before a demo).

---

## Architecture

Single Next.js (App Router) full-stack app — no separate backend:

```
app/
  page.tsx  weather/  photo-check/  chat/        # 4 client pages
  api/weather/route.ts                            # Open-Meteo -> rules engine
  api/satellite/status/route.ts                   # NASA GIBS layer config + dates
  api/agromonitoring/route.ts + image/route.ts    # AgroMonitoring: polygon + real NDVI/imagery/soil (key server-side)
  api/analyze-photo/route.ts                      # vision LLM (strict JSON)
  api/chat/route.ts                               # assistant w/ context
components/
  farm/FarmMap.tsx, FarmDashboard.tsx, CropPicker.tsx   # farm dashboard UI
  BigActionCard, LanguageSwitcher, Weather*, ForecastStrip,
  CameraCapture, AnalysisResultCard, ConfidenceBadge,
  ChatBubble/ChatInput, shared Loading/Error/EmptyState…
lib/
  weatherRules.ts        # pure deterministic weather thresholds engine (no LLM)
  agriculture.ts         # pure agri engine: weather + NDVI + crop -> insights
  farmGeometry.ts        # shoelace area, point-in-polygon, tile helpers
  crops.ts               # bilingual crop catalog + conservative crop profiles
  satelliteStats.ts      # client: decodes real GIBS NDVI/cloud tiles in-polygon
  i18n.ts / I18nProvider.tsx
  geo.ts                 # Rajasthan-first location list (hi/en)
  clientImage.ts         # blur/dark pre-check + resize/compress
  clientStore.ts         # weather/satellite/farm cache + cross-feature context
  server/weatherService.ts, satelliteService.ts, agromonitoring.ts,
  cropAnalysis.ts, agricultureKnowledge.ts, plantId.ts, ai.ts, prompts.ts,
  demo.ts, rateLimit.ts
locales/hi.json  locales/en.json      # farmer-register Hindi + English, mirrored
scripts/check-i18n.mjs
```

- **Weather:** Open-Meteo (free, keyless) → `analyzeWeather()` literal
  thresholds → localized payload. `DEMO_MODE=true` runs the *same* engine on
  deterministic sample scenarios so live/demo behaviour never diverges.
- **Farm dashboard:** location → Leaflet field polygon (area in ha/acres) →
  crop picker → dashboard. NDVI/cloud statistics are measured client-side
  from real NASA GIBS tiles inside the polygon using the official colormaps;
  the agri rules engine (`lib/agriculture.ts`) only hedges with that real
  data — no LLM, no invented numbers. Satellites are never called "live":
  the UI shows the observation date and "X days ago" when imagery is old.
- **AI:** provider-agnostic REST client (Anthropic or OpenAI) inside
  `lib/server/ai.ts`; strict vision JSON contract in `lib/server/prompts.ts`;
  malformed JSON is silently retried once. No key ⇒ deterministic demo
  responders (`lib/server/demo.ts`) with honest "demo mode" labels in the UI.
- **Photos:** never persisted — processed in-memory and discarded.
- **i18n:** no hardcoded UI strings; adding a 3rd language = new
  `locales/xx.json` + `Lang` union entry. AI output language is forced via the
  system prompt on every call.

Future-work note (code comments + README): a dedicated offline CNN fine-tuned
on PlantVillage / PlantDoc / IP102 is the recommended path beyond MVP; the
general-purpose multimodal LLM is the hackathon-pragmatic choice.

---

## Demo script (≈3 minutes)

1. Fresh incognito window → homepage is self-explanatory in <3s.
2. Tap **हिं/EN** to switch language (architecture works both ways).
3. Pick **Barmer, Rajasthan** (top real-world KCC query district) — or allow
   geolocation.
4. Show today's summary + a real warning banner (check the chosen district's
   live weather beforehand; in `DEMO_MODE=true` a scripted heat/rain scenario
   triggers reliably).
5. Tap **Check a Crop Photo**, upload a pre-tested field photo of a
   mustard/bajra leaf with a visible issue (source 2–3 PlantDoc or real field
   photos before demo day; demo mode returns three deterministic, on-brand
   analyses).
6. Walk the result card — point at the confidence badge and the **"seek expert
   advice"** flag (your safety selling point).
7. Tap **Ask something else** → e.g. *"Ispe dawaai kab daalu?"* — watch the
   assistant redirect to an expert rather than guessing a dose.
8. Close with the stat: *"Rajasthan में अकेले मौसम से जुड़े 20 लाख से ज़्यादा
   calls Kisan Call Centre पर आए — यह tool वही ज़रूरत 24×7, बिना queue के,
   photo के साथ पूरी करता है।"*

Test checklist: rules engine against the 8 hand-built scenarios (run
`node /tmp` variant or re-verify §33 thresholds), 3 demo photos (healthy /
diseased / deliberately blurry), both languages with no raw keys leaking, and
360px width + throttled 3G in DevTools.

---

## Deployment

Deploy straight to **Vercel** from this repo (zero-config Next.js). Put the API
keys in the dashboard's env vars — never in git. If venue wifi is unreliable,
pre-record a screen capture and/or set `DEMO_MODE=true` to switch to guaranteed
sample data in seconds.
