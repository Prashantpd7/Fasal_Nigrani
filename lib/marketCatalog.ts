/**
 * Popular commodities shown on the Market (मंडी भाव) feature.
 * `agmarknetName` must match the official commodity name on the Agmarknet
 * portal (Ministry of Agriculture & Farmers Welfare). Live ids are resolved
 * from the portal's own filters API every launch — never hard-coded here.
 */

export interface PopularCommodity {
  id: string;
  agmarknetName: string;
  en: string;
  hi: string;
  emoji: string;
}

export const POPULAR_COMMODITIES: PopularCommodity[] = [
  { id: "wheat", agmarknetName: "Wheat", en: "Wheat", hi: "गेहूँ", emoji: "🌾" },
  { id: "mustard", agmarknetName: "Mustard", en: "Mustard", hi: "सरसों", emoji: "🌼" },
  { id: "bajra", agmarknetName: "Bajra(Pearl Millet/Cumbu)", en: "Bajra (Pearl millet)", hi: "बाजरा", emoji: "🌾" },
  { id: "jowar", agmarknetName: "Jowar(Sorghum)", en: "Jowar (Sorghum)", hi: "ज्वार", emoji: "🌾" },
  { id: "maize", agmarknetName: "Maize", en: "Maize", hi: "मक्का", emoji: "🌽" },
  { id: "rice", agmarknetName: "Rice", en: "Rice (Paddy)", hi: "चावल (धान)", emoji: "🌾" },
  { id: "cotton", agmarknetName: "Cotton", en: "Cotton", hi: "कपास", emoji: "☁️" },
  { id: "chana", agmarknetName: "Bengal Gram(Gram)(Whole)", en: "Chana (Gram)", hi: "चना", emoji: "🫘" },
  { id: "moong", agmarknetName: "Green Gram(Moong)(Whole)", en: "Moong", hi: "मूंग", emoji: "🫘" },
  { id: "groundnut", agmarknetName: "Groundnut", en: "Groundnut", hi: "मूंगफली", emoji: "🥜" },
  { id: "sesame", agmarknetName: "Sesamum(Sesame,Gingelly,Til)", en: "Sesame (Til)", hi: "तिल", emoji: "🌱" },
  { id: "soyabean", agmarknetName: "Soyabean", en: "Soyabean", hi: "सोयाबीन", emoji: "🫘" },
  { id: "tomato", agmarknetName: "Tomato", en: "Tomato", hi: "टमाटर", emoji: "🍅" },
  { id: "onion", agmarknetName: "Onion", en: "Onion", hi: "प्याज़", emoji: "🧅" },
  { id: "potato", agmarknetName: "Potato", en: "Potato", hi: "आलू", emoji: "🥔" },
  { id: "garlic", agmarknetName: "Garlic", en: "Garlic", hi: "लहसुन", emoji: "🧄" },
  { id: "ginger", agmarknetName: "Ginger(Green)", en: "Ginger", hi: "अदरक", emoji: "🫚" },
  { id: "chilli", agmarknetName: "Green Chilli", en: "Chilli", hi: "मिर्च", emoji: "🌶️" },
  { id: "coriander", agmarknetName: "Coriander(Leaves)", en: "Coriander", hi: "धनिया", emoji: "🌿" },
  { id: "turmeric", agmarknetName: "Turmeric", en: "Turmeric", hi: "हल्दी", emoji: "🟠" },
  { id: "sugarcane", agmarknetName: "Sugarcane", en: "Sugarcane", hi: "गन्ना", emoji: "🎋" },
];

export function commodityLabel(c: PopularCommodity, lang: "hi" | "en"): string {
  return lang === "hi" ? c.hi : c.en;
}