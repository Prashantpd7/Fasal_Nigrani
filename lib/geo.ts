import type { Lang } from "./i18n";

/**
 * Quick-pick farm locations. Rajasthan districts dominate (the demo story:
 * Hanumangarh, Barmer, Nagaur, Udaipur are top KCC calling districts — see
 * the master brief research notes). A few other major farm states are
 * included so the tool is not Rajasthan-only.
 */
export interface PlaceRec {
  id: string;
  en: string;
  hi: string;
  stateEn: string;
  stateHi: string;
  lat: number;
  lon: number;
}

export const GEO_PLACES: PlaceRec[] = [
  { id: "barmer", en: "Barmer", hi: "बाड़मेर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 25.75, lon: 71.39 },
  { id: "hanumangarh", en: "Hanumangarh", hi: "हनुमानगढ़", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 29.58, lon: 74.33 },
  { id: "nagaur", en: "Nagaur", hi: "नागौर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 27.2, lon: 73.73 },
  { id: "udaipur", en: "Udaipur", hi: "उदयपुर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 24.58, lon: 73.71 },
  { id: "jaipur", en: "Jaipur", hi: "जयपुर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 26.91, lon: 75.79 },
  { id: "jodhpur", en: "Jodhpur", hi: "जोधपुर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 26.29, lon: 73.03 },
  { id: "bikaner", en: "Bikaner", hi: "बीकानेर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 28.02, lon: 73.31 },
  { id: "jaisalmer", en: "Jaisalmer", hi: "जैसलमेर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 26.92, lon: 70.9 },
  { id: "sriganganagar", en: "Sri Ganganagar", hi: "श्रीगंगानगर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 29.9, lon: 73.88 },
  { id: "churu", en: "Churu", hi: "चूरू", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 28.29, lon: 74.97 },
  { id: "sikar", en: "Sikar", hi: "सीकर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 27.61, lon: 75.14 },
  { id: "ajmer", en: "Ajmer", hi: "अजमेर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 26.45, lon: 74.64 },
  { id: "kota", en: "Kota", hi: "कोटा", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 25.21, lon: 75.86 },
  { id: "alwar", en: "Alwar", hi: "अलवर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 27.56, lon: 76.62 },
  { id: "bharatpur", en: "Bharatpur", hi: "भरतपुर", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 27.22, lon: 77.49 },
  { id: "pali", en: "Pali", hi: "पाली", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 25.77, lon: 73.32 },
  { id: "bhilwara", en: "Bhilwara", hi: "भीलवाड़ा", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 25.35, lon: 74.63 },
  { id: "tonk", en: "Tonk", hi: "टोंक", stateEn: "Rajasthan", stateHi: "राजस्थान", lat: 26.17, lon: 75.79 },
  // Other major farming states (small selection)
  { id: "ludhiana", en: "Ludhiana", hi: "लुधियाना", stateEn: "Punjab", stateHi: "पंजाब", lat: 30.9, lon: 75.86 },
  { id: "amritsar", en: "Amritsar", hi: "अमृतसर", stateEn: "Punjab", stateHi: "पंजाब", lat: 31.63, lon: 74.87 },
  { id: "lucknow", en: "Lucknow", hi: "लखनऊ", stateEn: "Uttar Pradesh", stateHi: "उत्तर प्रदेश", lat: 26.85, lon: 80.95 },
  { id: "varanasi", en: "Varanasi", hi: "वाराणसी", stateEn: "Uttar Pradesh", stateHi: "उत्तर प्रदेश", lat: 25.32, lon: 82.99 },
  { id: "indore", en: "Indore", hi: "इंदौर", stateEn: "Madhya Pradesh", stateHi: "मध्य प्रदेश", lat: 22.72, lon: 75.86 },
  { id: "nashik", en: "Nashik", hi: "नासिक", stateEn: "Maharashtra", stateHi: "महाराष्ट्र", lat: 20.0, lon: 73.79 },
  { id: "hissar", en: "Hisar", hi: "हिसार", stateEn: "Haryana", stateHi: "हरियाणा", lat: 29.15, lon: 75.7 },
];

export function placeName(p: PlaceRec, lang: Lang): string {
  return lang === "hi" ? p.hi : p.en;
}

export function stateName(p: PlaceRec, lang: Lang): string {
  return lang === "hi" ? p.stateHi : p.stateEn;
}

/** Rough haversine distance in km between two coordinates. */
export function kmDistance(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
