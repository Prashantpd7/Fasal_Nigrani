# Fasal Nigrani — Final Setup Report (Real AI Crop Photo Analysis)

**Date:** September 8, 2026 · **Status:** the pipeline is fully built and
verified (vision model → ICAR/KVK knowledge verification → confidence →
safe result → optional Plant.id signal). It goes live the moment you add ONE
API key. **Nothing in this feature is fake — with no key it refuses politely
instead of inventing results.**

---

## 1. APIs integrated

| API | Role | Status |
|---|---|---|
| **Google Gemini (Vision)** | Looks at the farmer's photos and suggests possible conditions + confidence | Primary vision model (`GEMINI_API_KEY`) |
| Anthropic Claude / OpenAI (vision) | Same role — automatic fallback if Gemini is not configured | Supported (existing keys still work) |
| **Plant.id** | Second automated disease signal — **never truth, only compared** | Optional (`PLANT_ID_API_KEY`) |
| ICAR/KVK knowledge layer (in-app) | Verifies every Gemini suspicion and provides management steps + source | Built-in, always on |

## 2. APIs that require API keys

- **Gemini:** required for real photo analysis → `GEMINI_API_KEY`
  (free key: https://aistudio.google.com/app/apikey).
- **Plant.id:** optional, paid → `PLANT_ID_API_KEY`.
- Anthropic (`ANTHROPIC_API_KEY`) / OpenAI (`OPENAI_API_KEY`): optional
  alternatives; provider order is Gemini → Anthropic → OpenAI.

## 3. Exact environment variable names

```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash          # optional
PLANT_ID_API_KEY=                       # optional
PLANT_ID_API_URL=https://api.plant.id/v2/health_assessment   # optional
ANTHROPIC_API_KEY=                      # optional alternative
OPENAI_API_KEY=                         # optional alternative
```

## 4. Where each API key should be added

All keys go into **`.env`** at the project root (copy `.env.example` first).
They are read **only in server API routes** (`/api/analyze-photo`,
`/api/chat`) — never shipped to the browser. After editing `.env`, restart
`npm run dev`.

## 5. Which features are completely free

- Everything except photo/chat AI: weather (Open-Meteo), satellite map and
  NDVI (Esri + NASA GIBS), the whole farm dashboard — free, no keys.
- Photo analysis and chat AI need a (free-tier) Gemini key. Gemini's free
  tier is generous for a hackathon demo.
- The ICAR/KVK knowledge layer is built into the app — free, no API.

## 6. Which services have limits

- **Gemini free tier:** rate/usage limits apply (fine for demos); the app
  rate-limits photo analysis per IP (20/hour) and chat (120/hour) in memory.
- **Plant.id:** paid credits; only used when configured, and only as a second
  signal. If it fails or runs out of credits the analysis still completes
  (Plant.id is skipped silently).
- **Open-Meteo / Esri / NASA GIBS:** free public services with fair-use
  limits; the app caches aggressively.

## 7. Which trusted agricultural sources are used

A curated, bilingual knowledge base in `lib/server/agricultureKnowledge.ts`
covering 30+ conditions across the crops in the app (wheat, mustard, bajra,
maize, cotton, chickpea, cumin, rice, tomato, potato, chilli, onion,
groundnut, sugarcane). Sources per entry (shown to the farmer):
**ICAR-IIWBR** (wheat rust), **ICAR-IIMR** (maize), **ICAR-CICR** (cotton),
**ICAR-IIPR** (pulses), **ICAR-IIVR** (vegetables), **ICAR-CPRI** (potato),
**ICAR-DOGR** (onion), **ICAR-DGR** (groundnut), **ICAR-NRCSS** (cumin),
**ICAR-AICRP Bajra**, and general **ICAR advisory / KVK** for nutrient and
water stress. The layer is a compiled advisory layer (not an official API) —
it only contains well-documented, conservative guidance; chemical control is
always phrased as "per the current KVK/ICAR advisory — ask for product and
dose".

## 8. Exact crop-analysis flow

```
Farmer photos (1–4, camera/gallery)
  → client validation (type, size, dark/blur pre-check, resize)
  → POST /api/analyze-photo (server-side)
  → Gemini Vision analyses ALL photos together
      → strict JSON: crop, health, suspected_conditions[], confidence_pct,
        observations, ask_more_photos, product_mentioned
  → ICAR/KVK knowledge verification
      (condition name + symptom keywords vs knowledge base → verified /
       likely / uncertain — or "could not be reliably verified")
  → final confidence %  (verified = model %, likely = −10,
                         uncertain/no-match = capped ≤35%)
  → safe recommendation (management steps from the knowledge base ONLY)
  → Plant.id consulted in parallel (optional) and compared
  → farmer-friendly result card (Crop / Health / Problem / Confidence % /
    Why / Recommended action / Warning / Source) + "Not a guaranteed
    diagnosis" disclaimer
```

## 9. Whether Plant.id was integrated

**Yes — as an optional second signal.** When `PLANT_ID_API_KEY` is set, the
route calls Plant.id health assessment in parallel and compares its
healthy/unhealthy verdict with ours. Agreement adds confidence; **disagreement
is surfaced to the farmer as "verification required"** — the app never
silently picks one source. Without a key, Plant.id is simply absent.

## 10. What happens when AI confidence is low

- Final confidence < 40% triggers a prominent banner with the exact message:
  *"The image is not sufficient for a reliable diagnosis. Please upload a
  clearer photo or consult a local agriculture expert/KVK."*
- The model's requested additional photos are listed (close-up leaf, underside
  of leaf, full plant, stem, fruit).
- The farmer is always told to verify with KVK/expert before any action.

## 11. What happens when sources disagree

- **Gemini vs knowledge base:** the knowledge base wins for naming/management.
  If Gemini's suspicion doesn't match any trusted entry, the result says
  "could not be reliably verified", confidence is capped at 35%, and only
  safe generic steps (cleaner photos, sample to KVK, no chemicals yet) are
  given.
- **Gemini vs Plant.id:** if the two health verdicts disagree, the result
  shows a "second automated check disagrees — treat as unconfirmed, verify
  with a KVK/expert" notice.

## 12. All commands required to run the project

```bash
npm install
cp .env.example .env        # then add GEMINI_API_KEY=...
npm run dev                 # http://localhost:3000
# production:
npm run build && npm start
# checks:
npm run typecheck
npm run lint
node scripts/check-i18n.mjs
```

## 13. All remaining manual setup steps

1. Get a free Gemini API key at https://aistudio.google.com/app/apikey.
2. Paste it into `.env` as `GEMINI_API_KEY=...` and restart the dev server.
3. (Optional) Add `PLANT_ID_API_KEY` if you want the second signal.
4. (Optional) Test with 2–3 real field photos (a healthy leaf, a clearly
   diseased leaf, a blurry one) to see verified / low-confidence paths.
5. Check the weather/farm dashboard still works (untouched by this feature).

---

*Golden rule kept everywhere: no fake results. No hallucinated diseases,
brands or doses. No "100% detection". The app prefers an honest
"not enough information / please verify with KVK" over a confident guess.*