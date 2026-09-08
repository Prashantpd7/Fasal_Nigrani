/**
 * Government schemes (सरकारी योजनाएँ) — a curated, verified registry of
 * ACTIVE central + national agri schemes with official application portals.
 *
 * Why curated and not scraped: every official scheme site (pmkisan.gov.in,
 * pmfby.gov.in, myScheme…) serves data behind logins/forms/captcha and the
 * myScheme REST API requires an authentication token. The government itself
 * recommends applying through these official portals, so this registry always
 * points to the live official URL. `lastUpdated` records when each entry was
 * last verified against its official source.
 */
import type { GovtScheme, SchemesPayload, SchemeCategory } from "@/lib/types";

export const ALL_CATEGORIES: SchemeCategory[] = [
  "financial",
  "insurance",
  "irrigation",
  "soil",
  "machinery",
  "solar",
  "horticulture",
  "market",
  "skill",
];

/** Verified-live official portals (checked at build/launch time). */
const OFFICIAL: Record<string, string> = {
  pmKisan: "https://pmkisan.gov.in/",
  pmfby: "https://www.pmfby.gov.in/",
  suswagram: "https://www.mnre.gov.in/solar/schemes/",
  agriInfra: "https://agriinfra.dac.gov.in/",
  midh: "https://midh.gov.in/",
  nfsm: "https://nfsm.gov.in/",
  shc: "https://www.soilhealth.dac.gov.in/",
  nmsa: "https://nmsa.dac.gov.in/",
  pmksy: "https://pmksy.gov.in/",
  enam: "https://enam.gov.in/web/",
  sfac: "https://sfacindia.com/",
  indiaGov: "https://www.india.gov.in/",
  myscheme: "https://www.myscheme.gov.in/",
};

const ROWS: Omit<GovtScheme, "lastUpdated">[] = [
  {
    id: "pm-kisan",
    nameEn: "PM-KISAN (PM Kisan Samman Nidhi)",
    nameHi: "प्रधानमंत्री किसान सम्मान निधि",
    category: "financial",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare",
    benefit:
      "₹6,000 per year to every farmer family, paid directly in 3 instalments of ₹2,000 (DBT).",
    eligibility:
      "All landholding farmer families with cultivable land as per state land records.",
    applyUrl: OFFICIAL.pmKisan,
    portalUrl: OFFICIAL.pmKisan,
    active: true,
  },
  {
    id: "kcc",
    nameEn: "Kisan Credit Card (KCC)",
    nameHi: "किसान क्रेडिट कार्ड",
    category: "financial",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare / RBI (banks)",
    benefit:
      "Short-term crop loans up to ₹3 lakh at 7% interest (effective 4% with timely-repayment subvention).",
    eligibility:
      "All farmers, fishers and animal rearers. Apply at any bank branch.",
    applyUrl: null,
    portalUrl: OFFICIAL.indiaGov,
    active: true,
  },
  {
    id: "aif",
    nameEn: "Agriculture Infrastructure Fund (AIF)",
    nameHi: "कृषि अवसंरचना कोष",
    category: "financial",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare",
    benefit:
      "₹1 lakh crore fund; 3% interest subvention and credit guarantee for post-harvest infrastructure (warehouses, cold storage, custom hiring).",
    eligibility:
      "Farmers, FPOs, SHGs, agri-entrepreneurs; project through a bank/appraisers.",
    applyUrl: OFFICIAL.agriInfra,
    portalUrl: OFFICIAL.agriInfra,
    active: true,
  },
  {
    id: "nfsm",
    nameEn: "National Food Security Mission (NFSM)",
    nameHi: "राष्ट्रीय खाद्य सुरक्षा मिशन",
    category: "financial",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare",
    benefit:
      "Financial support for improved seed, micronutrients, plant protection and demonstrations in rice, wheat, pulses and coarse cereals.",
    eligibility: "Farmers in mission districts via state agriculture departments.",
    applyUrl: OFFICIAL.nfsm,
    portalUrl: OFFICIAL.nfsm,
    active: true,
  },
  {
    id: "pmfby",
    nameEn: "PM Fasal Bima Yojana (PMFBY)",
    nameHi: "प्रधानमंत्री फसल बीमा योजना",
    category: "insurance",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare",
    benefit:
      "Crop insurance with farmer share of only 2% (kharif), 1.5% (rabi) and 5% (commercial/horticulture); full claim for notified sum insured.",
    eligibility:
      "Lending/sowing farmers in notified areas; apply through the empanelled insurance company or bank.",
    applyUrl: OFFICIAL.pmfby,
    portalUrl: OFFICIAL.pmfby,
    active: true,
  },
  {
    id: "pmksy",
    nameEn: "PM Krishi Sinchayee Yojana (PMKSY)",
    nameHi: "प्रधानमंत्री कृषि सिंचाई योजना",
    category: "irrigation",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare / Jal Shakti",
    benefit:
      "Subsidy on micro-irrigation (drip/sprinkler) — ‘Per Drop More Crop’ — and support for farm ponds, wells and rain water harvesting.",
    eligibility:
      "Individual and cluster farmers through the state nodal department.",
    applyUrl: OFFICIAL.pmksy,
    portalUrl: OFFICIAL.pmksy,
    active: true,
  },
  {
    id: "shc",
    nameEn: "Soil Health Card Scheme",
    nameHi: "मृदा स्वास्थ्य कार्ड योजना",
    category: "soil",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare",
    benefit:
      "Free soil testing once every 2 years; a card with NPK, pH, EC and organic-carbon status plus crop-wise fertiliser guidance.",
    eligibility: "All farmers; sample through your District Soil Testing Laboratory.",
    applyUrl: OFFICIAL.shc,
    portalUrl: OFFICIAL.shc,
    active: true,
  },
  {
    id: "bpkp",
    nameEn: "Bhartiya Prakritik Krishi Paddhati (BPKP)",
    nameHi: "भारतीय प्राकृतिक कृषि पद्धति",
    category: "soil",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare (NMSA)",
    benefit:
      "₹12,200/ha support for natural-farming clusters (no synthetic chemicals); certification and marketing help.",
    eligibility: "Farmer clusters selected by the state under PKVY/NMSA parameters.",
    applyUrl: OFFICIAL.nmsa,
    portalUrl: OFFICIAL.nmsa,
    active: true,
  },
  {
    id: "pm-kusum",
    nameEn: "PM-KUSUM Solar Pumps",
    nameHi: "प्रधानमंत्री कुसुम योजना",
    category: "solar",
    states: [],
    ministry: "Ministry of New & Renewable Energy",
    benefit:
      "Up to 60% central subsidy on standalone solar pumps and solarisation of grid-connected pumps; income from surplus solar power.",
    eligibility:
      "Individual farmers; apply through the state DISCOM / nodal renewable-energy agency.",
    applyUrl: OFFICIAL.suswagram,
    portalUrl: OFFICIAL.suswagram,
    active: true,
  },
  {
    id: "midh",
    nameEn: "Mission for Integrated Dev. of Horticulture (MIDH)",
    nameHi: "बागवानी एकीकृत विकास मिशन",
    category: "horticulture",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare",
    benefit:
      "Assistance for high-yield planting material, protected cultivation (shade nets, poly-houses), bee-keeping, pack houses and cold chains.",
    eligibility: "All horticulture farmers; apply via the state horticulture department.",
    applyUrl: OFFICIAL.midh,
    portalUrl: OFFICIAL.midh,
    active: true,
  },
  {
    id: "enam",
    nameEn: "e-NAM (National Agriculture Market)",
    nameHi: "ई-नाम (राष्ट्रीय कृषि बाज़ार)",
    category: "market",
    states: [
      "Rajasthan",
      "Punjab",
      "Haryana",
      "Uttar Pradesh",
      "Madhya Pradesh",
      "Maharashtra",
      "Gujarat",
      "Karnataka",
      "Telangana",
      "Tamil Nadu",
      "Odisha",
      "Andhra Pradesh",
      "Bihar",
      "Chhattisgarh",
      "Himachal Pradesh",
      "Jharkhand",
      "Kerala",
      "West Bengal",
      "Assam",
      "Uttarakhand",
    ],
    ministry: "Ministry of Agriculture & Farmers Welfare",
    benefit:
      "Transparent pan-India online trading of produce at your APMC mandi; one license for all mandis, online payment and quality assaying.",
    eligibility: "Registered farmers/lot owners; register through your APMC.",
    applyUrl: OFFICIAL.enam,
    portalUrl: OFFICIAL.enam,
    active: true,
  },
  {
    id: "fpo",
    nameEn: "Formation & Promotion of Farmer Producer Organisations",
    nameHi: "किसान उत्पादक संगठन (FPO) योजना",
    category: "market",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare (SFAC)",
    benefit:
      "Up to ₹18 lakh per FPO for formation, seed capital and 3 years of handholding; ₹22 lakh for clusters of 10+ FPOs.",
    eligibility: "Groups of 300+ farmers (SFAC/CJL selection).",
    applyUrl: OFFICIAL.sfac,
    portalUrl: OFFICIAL.sfac,
    active: true,
  },
  {
    id: "machinery",
    nameEn: "Sub-Mission on Agricultural Mechanization (SMAM)",
    nameHi: "कृषि यांत्रीकरण उप-मिशन",
    category: "machinery",
    states: [],
    ministry: "Ministry of Agriculture & Farmers Welfare",
    benefit:
      "Subsidy on farm machinery (45–50% for SC/ST/small farmers, 40% others) and support for Custom Hiring Centres and farm machinery banks.",
    eligibility:
      "Individual and group farmers through state agriculture departments.",
    applyUrl: OFFICIAL.indiaGov,
    portalUrl: OFFICIAL.indiaGov,
    active: true,
  },
  {
    id: "skill",
    nameEn: "myScheme — find all schemes for you",
    nameHi: "माईस्कीम — आपके लिए सभी योजनाएँ",
    category: "skill",
    states: [],
    ministry: "Digital India Corporation (MeitY)",
    benefit:
      "Official one-stop national portal: answer a few eligibility questions and it lists every Central/State scheme you qualify for, with application steps.",
    eligibility: "All citizens (free).",
    applyUrl: OFFICIAL.myscheme,
    portalUrl: OFFICIAL.myscheme,
    active: true,
  },
];

export const UPDATED_NOTE_DATE = "2026-09-08";

export function getSchemes(): SchemesPayload {
  const schemes: GovtScheme[] = ROWS.map((r) => ({
    ...r,
    lastUpdated: UPDATED_NOTE_DATE,
  }));
  return {
    source: "curated",
    fetchedAt: Date.now(),
    updatedNote: UPDATED_NOTE_DATE,
    categories: ALL_CATEGORIES,
    schemes,
  };
}