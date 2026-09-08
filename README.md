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

1. **Weather & Crop Advice** (`/weather`) — pick your location (geolocation or
   a Rajasthan-first district list), and a **deterministic rules engine**
   (zero LLM calls) turns current + hourly + 7-day Open-Meteo data into
   colour-coded warnings ("baarish ho sakti hai"), a 3–7 day forecast strip and
   a "what to do today" card — always phrased probabilistically.
2. **Crop Photo Check** (`/photo-check`) — camera-first capture with gallery
   fallback, client-side dark/blur pre-check *before* any AI spend, then a
   vision model (Claude/GPT-4o) answers via a **strict JSON contract**: finding,
   low/medium/high confidence badge, what-to-do / what-to-avoid, and a
   never-hidden "seek expert" prompt when needed. Photos are resized client-side
   and never stored.
3. **Ask a Question** (`/chat`) — typed or **spoken** (Web Speech API, graceful
   fallback) questions answered in ≤~80 words with the farmer's weather and
   latest photo-check attached as context when relevant.

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

Keys are read **server-side only** (Next.js API routes) — never shipped to the
browser. `/api/analyze-photo` and `/api/chat` are rate-limited per IP
(in-memory) to protect a demo day.

---

## Architecture

Single Next.js (App Router) full-stack app — no separate backend:

```
app/
  page.tsx  weather/  photo-check/  chat/        # 4 client pages
  api/weather/route.ts                            # Open-Meteo -> rules engine
  api/analyze-photo/route.ts                      # vision LLM (strict JSON)
  api/chat/route.ts                               # assistant w/ context
components/        # BigActionCard, LanguageSwitcher, Weather*, ForecastStrip,
                   # CameraCapture, AnalysisResultCard, ConfidenceBadge,
                   # ChatBubble/ChatInput, shared Loading/Error/EmptyState…
lib/
  weatherRules.ts        # pure deterministic thresholds engine (no LLM)
  i18n.ts / I18nProvider.tsx
  geo.ts                 # Rajasthan-first location list (hi/en)
  clientImage.ts         # blur/dark pre-check + resize/compress
  clientStore.ts         # offline weather cache + cross-feature context
  server/weatherService.ts, ai.ts, prompts.ts, analysis.ts, demo.ts, rateLimit.ts
locales/hi.json  locales/en.json      # farmer-register Hindi + English, mirrored
scripts/check-i18n.mjs
```

- **Weather:** Open-Meteo (free, keyless) → `analyzeWeather()` literal
  thresholds → localized payload. `DEMO_MODE=true` runs the *same* engine on
  deterministic sample scenarios so live/demo behaviour never diverges.
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
