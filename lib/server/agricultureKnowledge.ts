import type { Lang } from "@/lib/i18n";
import type {
  ConditionType,
  KnowledgeMatch,
  SuspectedCondition,
  VerificationLevel,
} from "@/lib/types";

/**
 * Trusted agricultural knowledge layer (§ Crop analysis — verification).
 *
 * The vision model (Gemini) may only SUGGEST conditions. This layer verifies
 * those suggestions against a curated, bilingual knowledge base compiled from
 * ICAR and KVK crop advisories (ICAR-IIWBR wheat rust advisories, ICAR-IIMR
 * maize advisories, ICAR-CICR cotton advisories, AICRP/CAZRI Rajasthan
 * material, KVK crop clinics and e-Krishi Shiksha modules).
 *
 * Rules enforced here:
 *  - No brand names. No exact doses. Chemical control is only ever phrased as
 *    "as per the local KVK/ICAR advisory — ask for the current product+dose".
 *  - If no entry reliably matches the model's suspicion, we say so honestly
 *    ("could not be reliably verified") and return safe generic steps.
 *  - Every recommendation carries its source.
 */

interface BilingualText {
  en: string;
  hi: string;
}

export interface KnowledgeEntry {
  id: string;
  /** Crop this entry applies to; "general" applies to every crop. */
  crop: string;
  type: ConditionType;
  name: BilingualText;
  /** Other common names used for matching (English + transliterated). */
  aliases: string[];
  symptoms: BilingualText[];
  management: BilingualText[];
  warning: BilingualText | null;
  /** Symptom keywords (EN, lowercased) used for scoring model observations. */
  symptomKeywords: string[];
  /** Trusted source attribution. */
  source: string;
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  // ---------------------------------------------------------------- WHEAT
  {
    id: "wheat-yellow-rust",
    crop: "wheat",
    type: "disease",
    name: { en: "Yellow rust", hi: "पीला रतुआ (Yellow rust)" },
    aliases: ["yellow rust", "stripe rust", "peela ratua", "ratua"],
    symptoms: [
      { en: "Yellow-orange powdery pustules in rows/stripes on the leaves.", hi: "पत्तियों पर लाइनों में पीले-नारंगी चूर्ण जैसे धब्बे।" },
      { en: "Spreads quickly in cool, humid weather (often February–March).", hi: "ठंडे, नम मौसम में तेज़ी से फैलता है (अक्सर फरवरी–मार्च)।" },
      { en: "Affected leaves turn yellow and dry early.", hi: "प्रभावित पत्तियाँ पीली होकर जल्दी सूख जाती हैं।" },
    ],
    management: [
      { en: "Grow rust-tolerant varieties recommended for your area.", hi: "अपने इलाके के लिए सुझाई गई रतुआ-सहनशील किस्में बोएँ।" },
      { en: "Walk the field weekly; if rust appears, remove badly affected leaves/plants and destroy them.", hi: "हर हफ़्ते खेत देखें; रतुआ दिखे तो ज़्यादा प्रभावित पत्तियाँ/पौधे उखाड़कर नष्ट करें।" },
      { en: "For spraying, ask your Krishi Vigyan Kendra / ICAR advisory for the current recommended fungicide and dose.", hi: "स्प्रे के लिए कृषि विज्ञान केंद्र / ICAR सलाह से वर्तमान अनुशंसित फफूँदनाशक और मात्रा पूछें।" },
    ],
    warning: { en: "Rust can spread across the whole field within days in damp weather.", hi: "नम मौसम में रतुआ कुछ ही दिनों में पूरे खेत में फैल सकता है।" },
    symptomKeywords: ["yellow", "pustule", "stripe", "powder", "rust", "orange", "patti peeli"],
    source: "ICAR-IIWBR advisory / KVK",
  },
  {
    id: "wheat-leaf-blight",
    crop: "wheat",
    type: "disease",
    name: { en: "Leaf blight", hi: "पत्ती झुलसा (Leaf blight)" },
    aliases: ["leaf blight", "blight", "brown spot", "jhootha"],
    symptoms: [
      { en: "Oval brown spots on leaves, tips dry and look burnt.", hi: "पत्तियों पर भूरे गोल धब्बे, सिरे सूखकर जले जैसे दिखते हैं।" },
      { en: "Spots may join into large dead patches in humid weather.", hi: "नम मौसम में धब्बे मिलकर बड़े सूखे हिस्से बना लेते हैं।" },
    ],
    management: [
      { en: "Remove and destroy heavily affected leaves; keep the field free of weeds.", hi: "ज़्यादा प्रभावित पत्तियाँ तोड़कर नष्ट करें; खेत को खरपतवार से साफ़ रखें।" },
      { en: "Avoid sowing too dense and do not over-irrigate in the evening.", hi: "बहुत घना बुवाई न करें और शाम को ज़रूरत से ज़्यादा पानी न दें।" },
      { en: "For chemicals, follow the current KVK/ICAR advisory for product and dose.", hi: "दवा के लिए वर्तमान KVK/ICAR सलाह के अनुसार ही उत्पाद और मात्रा लें।" },
    ],
    warning: null,
    symptomKeywords: ["brown", "spot", "blight", "burn", "dry tip"],
    source: "ICAR advisory / KVK",
  },

  // --------------------------------------------------------------- MUSTARD
  {
    id: "mustard-aphid",
    crop: "mustard",
    type: "pest",
    name: { en: "Mustard aphid", hi: "सरसों का चेपा/माहू (Aphid)" },
    aliases: ["aphid", "chepa", "mahu", "sucking insect"],
    symptoms: [
      { en: "Clusters of tiny greenish insects on tender leaves, flowers and pods.", hi: "कोमल पत्तियों, फूलों और फलियों पर छोटे हरे कीड़ों के झुंड।" },
      { en: "Sticky honeydew on plants; black sooty mold may follow.", hi: "पौधों पर चिपचिपा पदार्थ; बाद में काली फफूँद भी लग सकती है।" },
      { en: "Leaves curl, plants look weak and stop growing well.", hi: "पत्तियाँ मुड़ जाती हैं, पौधे कमज़ोर दिखते हैं और बढ़त रुक जाती है।" },
    ],
    management: [
      { en: "Check the underside of leaves and young shoots every 3–4 days.", hi: "हर 3–4 दिन में पत्तियों के नीचे और नई टहनियों की जाँच करें।" },
      { en: "A strong water spray can knock down early aphid colonies; remove badly infested tips.", hi: "तेज़ पानी की धार से शुरुआती चेपा हट सकता है; ज़्यादा प्रभावित सिरे तोड़ दें।" },
      { en: "For spraying, ask your KVK/ICAR advisory for the recommended insecticide and dose.", hi: "स्प्रे के लिए KVK/ICAR सलाह से अनुशंसित कीटनाशक और मात्रा पूछें।" },
    ],
    warning: null,
    symptomKeywords: ["aphid", "honeydew", "sticky", "curl", "cluster", "chepa", "mahu"],
    source: "ICAR advisory / KVK",
  },
  {
    id: "mustard-white-rust",
    crop: "mustard",
    type: "disease",
    name: { en: "White rust", hi: "सफ़ेद रतुआ (White rust)" },
    aliases: ["white rust", "white blister", "staghead"],
    symptoms: [
      { en: "White blister-like pustules on leaves, often on the underside.", hi: "पत्तियों पर सफ़ेद फफोले जैसे धब्बे, अक्सर पत्ती के नीचे।" },
      { en: "Flower heads may become swollen and distorted (staghead).", hi: "फूल के सिरे फूलकर विकृत हो सकते हैं।" },
    ],
    management: [
      { en: "Remove and destroy affected leaves/plants early.", hi: "प्रभावित पत्तियाँ/पौधे जल्दी तोड़कर नष्ट करें।" },
      { en: "Rotate crops and avoid growing mustard on the same field year after year.", hi: "फसल चक्र अपनाएँ — एक ही खेत में हर साल सरसों न बोएँ।" },
      { en: "For chemicals, follow the current KVK/ICAR advisory.", hi: "दवा के लिए वर्तमान KVK/ICAR सलाह मानें।" },
    ],
    warning: null,
    symptomKeywords: ["white", "blister", "pustule", "swollen head"],
    source: "ICAR advisory / KVK",
  },

  // ----------------------------------------------------------------- BAJRA
  {
    id: "bajra-downy-mildew",
    crop: "bajra",
    type: "disease",
    name: { en: "Downy mildew (green ear)", hi: "भुट्टा रोग / कोमल फफूँद (Downy mildew)" },
    aliases: ["downy mildew", "green ear", "sclerospora"],
    symptoms: [
      { en: "Greenish-yellow streaks on leaves; white downy growth on the underside.", hi: "पत्तियों पर हरी-पीली धारियाँ; नीचे की तरफ़ सफ़ेद रूई जैसी वृद्धि।" },
      { en: "Earheads turn into leafy green structures instead of grains.", hi: "बालियों की जगह हरे पत्ती जैसे भाग बन जाते हैं, दाने नहीं बनते।" },
    ],
    management: [
      { en: "Use certified, disease-free seed and treat seed before sowing as per local advice.", hi: "प्रमाणित, रोग-मुक्त बीज लें और बुवाई से पहले स्थानीय सलाह के अनुसार बीजोपचार करें।" },
      { en: "Uproot and destroy affected plants as soon as symptoms appear.", hi: "लक्षण दिखते ही प्रभावित पौधे उखाड़कर नष्ट करें।" },
      { en: "For chemicals, follow the current KVK/ICAR advisory.", hi: "दवा के लिए वर्तमान KVK/ICAR सलाह मानें।" },
    ],
    warning: null,
    symptomKeywords: ["streak", "downy", "white growth", "green ear", "malformed"],
    source: "ICAR-AICRP Bajra advisory / KVK",
  },
  {
    id: "bajra-ergot",
    crop: "bajra",
    type: "disease",
    name: { en: "Ergot (sugary disease)", hi: "मधुरोग / एरगट (Ergot)" },
    aliases: ["ergot", "sugary disease", "honeydew"],
    symptoms: [
      { en: "Pinkish sticky honeydew drops on the earheads.", hi: "बालियों पर गुलाबी चिपचिपी बूँदें।" },
      { en: "Later, hard black grains (sclerotia) appear in the earhead.", hi: "बाद में बाली में कड़े काले दाने बन जाते हैं।" },
    ],
    management: [
      { en: "Do NOT feed affected grain to humans or animals — it can be poisonous.", hi: "प्रभावित दाना इंसानों या जानवरों को बिल्कुल न खिलाएँ — यह ज़हरीला हो सकता है।" },
      { en: "Avoid late sowing; keep the field weed-free during flowering.", hi: "देर से बुवाई न करें; फूल आने के समय खेत खरपतवार-मुक्त रखें।" },
      { en: "Ask your KVK about resistant varieties for your area.", hi: "अपने इलाके के लिए रोग-सहनशील किस्मों के बारे में KVK से पूछें।" },
    ],
    warning: { en: "Ergot-affected grain is toxic — never use it as food or fodder.", hi: "एरगट से प्रभावित दाना ज़हरीला होता है — इसे भोजन या चारे में कभी न डालें।" },
    symptomKeywords: ["honeydew", "sticky", "pink", "black grain", "ergot"],
    source: "ICAR advisory / KVK",
  },

  // ----------------------------------------------------------------- MAIZE
  {
    id: "maize-fall-armyworm",
    crop: "maize",
    type: "pest",
    name: { en: "Fall armyworm", hi: "सेना कीट (Fall armyworm)" },
    aliases: ["fall armyworm", "armyworm", "spodoptera", "sena keet"],
    symptoms: [
      { en: "Young leaves scraped into transparent 'window-pane' patches.", hi: "नई पत्तियों पर पारदर्शी 'खिड़की' जैसे धब्बे (ऊपरी परत खत्म)।" },
      { en: "Sawdust-like frass (droppings) inside the whorl; ragged chewing on leaves.", hi: "कल्ले के अंदर चूरा जैसी बीट; पत्तियों पर फटे-फटे निशान।" },
      { en: "Young caterpillars are greenish with a dark head; older ones have a Y-mark on the head.", hi: "छोटी इल्लियाँ हरी होती हैं; बड़ी इल्लियों के सिर पर Y जैसा निशान।" },
    ],
    management: [
      { en: "Scout fields twice a week from seedling stage; look inside the whorl.", hi: "अंकुरण से ही हफ़्ते में दो बार खेत देखें; कल्ले के अंदर झाँकें।" },
      { en: "Hand-pick and destroy egg masses and caterpillars; apply sand/ash in the whorl in early stages (as per local practice).", hi: "अंडे और इल्लियाँ हाथ से तोड़कर नष्ट करें; शुरुआती अवस्था में कल्ले में रेत/राख डालें (स्थानीय तरीके से)।" },
      { en: "For spraying, use only the current KVK/ICAR-recommended insecticide and dose.", hi: "स्प्रे केवल वर्तमान KVK/ICAR-अनुशंसित कीटनाशक और मात्रा से करें।" },
    ],
    warning: { en: "Fall armyworm spreads very fast and can damage the whole crop if missed early.", hi: "सेना कीट बहुत तेज़ी से फैलता है — शुरू में न पकड़ा जाए तो पूरी फसल को नुकसान पहुँचा सकता है।" },
    symptomKeywords: ["window", "frass", "whorl", "caterpillar", "ragged", "armyworm"],
    source: "ICAR-IIMR advisory / KVK",
  },
  {
    id: "maize-stem-borer",
    crop: "maize",
    type: "pest",
    name: { en: "Stem borer", hi: "तना छेदक (Stem borer)" },
    aliases: ["stem borer", "dead heart", "chilo"],
    symptoms: [
      { en: "Central shoot dries up (dead heart) in young plants.", hi: "छोटे पौधों में बीच की कोंपल सूख जाती है (dead heart)।" },
      { en: "Shot-hole damage on leaves and boreholes at the stem base.", hi: "पत्तियों पर छेद और तने के निचले हिस्से में बिल।" },
    ],
    management: [
      { en: "Destroy stubble after harvest to kill hibernating larvae.", hi: "कटाई के बाद ठूँठ नष्ट करें ताकि सोई इल्लियाँ मर जाएँ।" },
      { en: "Early-sown and well-irrigated crop suffers less; keep the field clean.", hi: "समय पर बुवाई और सही सिंचाई से नुकसान कम होता है; खेत साफ़ रखें।" },
      { en: "For chemicals, follow the current KVK/ICAR advisory.", hi: "दवा के लिए वर्तमान KVK/ICAR सलाह मानें।" },
    ],
    warning: null,
    symptomKeywords: ["dead heart", "shot hole", "bore", "stem hole", "borehole"],
    source: "ICAR-IIMR advisory / KVK",
  },

  // ---------------------------------------------------------------- COTTON
  {
    id: "cotton-bollworm",
    crop: "cotton",
    type: "pest",
    name: { en: "Cotton bollworm", hi: "अमेरिकन बॉलवर्म (Bollworm)" },
    aliases: ["bollworm", "helicoverpa", "ballworm"],
    symptoms: [
      { en: "Round boreholes in flowers, squares and young bolls.", hi: "फूलों, टिण्डों और छोटी टिंडियों में गोल छेद।" },
      { en: "Frass visible near the entry hole; damaged bolls rot or fall.", hi: "छेद के पास बीट दिखती है; क्षतिग्रस्त टिंडियाँ सड़ती या गिरती हैं।" },
    ],
    management: [
      { en: "Monitor with pheromone traps if available; hand-pick and destroy damaged bolls.", hi: "अगर उपलब्ध हों तो फेरोमोन ट्रैप लगाएँ; क्षतिग्रस्त टिंडियाँ तोड़कर नष्ट करें।" },
      { en: "Avoid continuous cotton on the same field; follow recommended sowing time.", hi: "एक ही खेत में लगातार कपास न लगाएँ; अनुशंसित समय पर बुवाई करें।" },
      { en: "For spraying, follow the current KVK/ICAR advisory only.", hi: "स्प्रे केवल वर्तमान KVK/ICAR सलाह के अनुसार करें।" },
    ],
    warning: null,
    symptomKeywords: ["bore", "boll", "hole", "frass", "worm", "squares"],
    source: "ICAR-CICR advisory / KVK",
  },
  {
    id: "cotton-jassid",
    crop: "cotton",
    type: "pest",
    name: { en: "Cotton jassid (leaf hopper)", hi: "कपास की जैसिड / पत्ती कूदक (Jassid)" },
    aliases: ["jassid", "leafhopper", "leaf hopper"],
    symptoms: [
      { en: "Leaf edges curl downward and turn yellow-brown.", hi: "पत्तियों के किनारे नीचे मुड़कर पीले-भूरे हो जाते हैं।" },
      { en: "Honeydew and sooty mold on the leaves in heavy attack.", hi: "ज़्यादा हमले में पत्तियों पर चिपचिपापन और काली फफूँद।" },
    ],
    management: [
      { en: "Keep the field free of weeds; avoid excessive nitrogen.", hi: "खेत को खरपतवार से मुक्त रखें; नाइट्रोजन ज़रूरत से ज़्यादा न डालें।" },
      { en: "Early control prevents the pest from spreading — check leaf undersides weekly.", hi: "रोकथाम जल्दी करें ताकि कीट न फैले — हर हफ़्ते पत्तियों के नीचे देखें।" },
      { en: "For chemicals, follow the current KVK/ICAR advisory.", hi: "दवा के लिए वर्तमान KVK/ICAR सलाह मानें।" },
    ],
    warning: null,
    symptomKeywords: ["curl", "leafhopper", "jassid", "yellow edge", "honeydew"],
    source: "ICAR-CICR advisory / KVK",
  },

  // -------------------------------------------------------------- CHICKPEA
  {
    id: "chickpea-wilt",
    crop: "chickpea",
    type: "disease",
    name: { en: "Chickpea wilt", hi: "चने की मुरझान (Wilt)" },
    aliases: ["wilt", "fusarium", "murjhan"],
    symptoms: [
      { en: "Plants yellow and wilt in patches; affected plants dry suddenly.", hi: "पौधे पीले होकर मुरझाते हैं; प्रभावित पौधे अचानक सूख जाते हैं।" },
      { en: "Brownish discoloration inside the stem base and roots.", hi: "तने के नीचे और जड़ों के अंदर भूरापन।" },
    ],
    management: [
      { en: "Use wilt-tolerant varieties; treat seed before sowing as per local advice.", hi: "मुरझान-सहनशील किस्में चुनें; बुवाई से पहले स्थानीय सलाह से बीजोपचार करें।" },
      { en: "Uproot and destroy affected plants; rotate with non-pulse crops.", hi: "प्रभावित पौधे उखाड़कर नष्ट करें; दालों के अलावा दूसरी फसल के साथ चक्र अपनाएँ।" },
      { en: "For chemicals, follow the current KVK/ICAR advisory.", hi: "दवा के लिए वर्तमान KVK/ICAR सलाह मानें।" },
    ],
    warning: null,
    symptomKeywords: ["wilt", "yellow", "dry", "patch", "sudden death", "murjhan"],
    source: "ICAR-IIPR advisory / KVK",
  },
  {
    id: "chickpea-pod-borer",
    crop: "chickpea",
    type: "pest",
    name: { en: "Pod borer (gram caterpillar)", hi: "फली छेदक इल्ली (Pod borer)" },
    aliases: ["pod borer", "helicoverpa", "ilhi", "caterpillar"],
    symptoms: [
      { en: "Round holes in pods; larvae feed on the grains inside.", hi: "फलियों में गोल छेद; अंदर के दाने खाए हुए।" },
      { en: "Greenish-brown caterpillars visible on the plant, often near flowers/pods.", hi: "पौधे पर हरी-भूरी इल्लियाँ दिखती हैं, अक्सर फूलों/फलियों के पास।" },
    ],
    management: [
      { en: "Erect bird perches and use pheromone traps where available.", hi: "जहाँ उपलब्ध हों, चिड़िया बैठने के डंडे और फेरोमोन ट्रैप लगाएँ।" },
      { en: "Hand-pick and destroy caterpillars during early infestation.", hi: "शुरुआती हमले में इल्लियाँ हाथ से तोड़कर नष्ट करें।" },
      { en: "For spraying, follow the current KVK/ICAR advisory only.", hi: "स्प्रे केवल वर्तमान KVK/ICAR सलाह के अनुसार करें।" },
    ],
    warning: null,
    symptomKeywords: ["pod", "hole", "borer", "caterpillar", "ilhi"],
    source: "ICAR-IIPR advisory / KVK",
  },

  // ----------------------------------------------------------------- CUMIN
  {
    id: "cumin-wilt",
    crop: "cumin",
    type: "disease",
    name: { en: "Cumin wilt", hi: "जीरे की मुरझान (Wilt)" },
    aliases: ["wilt", "murjhan"],
    symptoms: [
      { en: "Yellowing and wilting of plants in patches; roots turn brown.", hi: "पौधे पीले होकर मुरझाते हैं; जड़ें भूरी हो जाती हैं।" },
      { en: "Affected plants collapse and dry up.", hi: "प्रभावित पौधे गिरकर सूख जाते हैं।" },
    ],
    management: [
      { en: "Grow cumin on well-drained soil; avoid waterlogging.", hi: "जीरा अच्छी जल-निकासी वाली मिट्टी में बोएँ; पानी न भरने दें।" },
      { en: "Uproot and destroy affected plants; rotate crops.", hi: "प्रभावित पौधे उखाड़कर नष्ट करें; फसल चक्र अपनाएँ।" },
      { en: "For chemicals, follow the current KVK/ICAR advisory.", hi: "दवा के लिए वर्तमान KVK/ICAR सलाह मानें।" },
    ],
    warning: null,
    symptomKeywords: ["wilt", "yellow", "brown root", "collapse"],
    source: "ICAR-NRCSS advisory / KVK",
  },

  // ---------------------------------------------------------------- TOMATO
  {
    id: "tomato-late-blight",
    crop: "tomato",
    type: "disease",
    name: { en: "Late blight", hi: "आलू-टमाटर का पछेती झुलसा (Late blight)" },
    aliases: ["late blight", "phytophthora", "jhulsa"],
    symptoms: [
      { en: "Water-soaked dark patches on leaves and stems; white mold on the underside in damp weather.", hi: "पत्तियों और तनों पर गीले काले धब्बे; नमी में पत्ती के नीचे सफ़ेद फफूँद।" },
      { en: "Spots grow fast in cool wet weather and the plant collapses.", hi: "ठंडे नम मौसम में धब्बे तेज़ी से फैलकर पौधा गिर जाता है।" },
    ],
    management: [
      { en: "Remove and destroy affected plants immediately; avoid evening irrigation.", hi: "प्रभावित पौधे तुरंत उखाड़कर नष्ट करें; शाम को पानी न दें।" },
      { en: "Avoid dense planting and improve airflow between rows.", hi: "बहुत घनी बुवाई न करें; कतारों के बीच हवा आने दें।" },
      { en: "For spraying, follow the current KVK/ICAR advisory for product and dose.", hi: "स्प्रे के लिए वर्तमान KVK/ICAR सलाह से उत्पाद और मात्रा लें।" },
    ],
    warning: { en: "Late blight can destroy the whole crop within a week in wet weather — act fast.", hi: "नम मौसम में पछेती झुलसा एक हफ़्ते में पूरी फसल बर्बाद कर सकता है — जल्दी कार्रवाई करें।" },
    symptomKeywords: ["water", "dark patch", "blight", "white mold", "collapse"],
    source: "ICAR-IIVR advisory / KVK",
  },
  {
    id: "tomato-fruit-borer",
    crop: "tomato",
    type: "pest",
    name: { en: "Tomato fruit borer", hi: "टमाटर फल छेदक (Fruit borer)" },
    aliases: ["fruit borer", "helicoverpa", "phall chhedak"],
    symptoms: [
      { en: "Holes in green or ripe fruits; larvae feed inside the fruit.", hi: "कच्चे या पके फलों में छेद; अंदर इल्ली खाती है।" },
      { en: "Damaged fruits rot quickly and fall.", hi: "क्षतिग्रस्त फल जल्दी सड़कर गिर जाते हैं।" },
    ],
    management: [
      { en: "Remove and destroy infested fruits; keep the field weed-free.", hi: "प्रभावित फल तोड़कर नष्ट करें; खेत खरपतवार-मुक्त रखें।" },
      { en: "Use pheromone traps if available to monitor the pest.", hi: "अगर उपलब्ध हों तो निगरानी के लिए फेरोमोन ट्रैप लगाएँ।" },
      { en: "For spraying, follow the current KVK/ICAR advisory only.", hi: "स्प्रे केवल वर्तमान KVK/ICAR सलाह के अनुसार करें।" },
    ],
    warning: null,
    symptomKeywords: ["hole", "fruit", "borer", "rot"],
    source: "ICAR-IIVR advisory / KVK",
  },

  // ---------------------------------------------------------------- POTATO
  {
    id: "potato-late-blight",
    crop: "potato",
    type: "disease",
    name: { en: "Potato late blight", hi: "आलू का पछेती झुलसा (Late blight)" },
    aliases: ["late blight", "phytophthora", "jhulsa"],
    symptoms: [
      { en: "Dark brown water-soaked blotches on leaves; white mold ring on the underside.", hi: "पत्तियों पर गहरे भूरे गीले धब्बे; नीचे की तरफ़ सफ़ेद फफूँद की किनारी।" },
      { en: "Rapid wilting and rotting of foliage in cool, humid weather.", hi: "ठंडे नम मौसम में पत्तियाँ तेज़ी से सड़कर गिर जाती हैं।" },
    ],
    management: [
      { en: "Use certified disease-free seed tubers.", hi: "प्रमाणित, रोग-मुक्त बीज कंद लगाएँ।" },
      { en: "Remove and destroy affected plants; avoid overhead watering in the evening.", hi: "प्रभावित पौधे उखाड़कर नष्ट करें; शाम को ऊपर से पानी न छिड़कें।" },
      { en: "For spraying, follow the current KVK/ICAR advisory for product and dose.", hi: "स्प्रे के लिए वर्तमान KVK/ICAR सलाह से उत्पाद और मात्रा लें।" },
    ],
    warning: { en: "Late blight is very destructive in potato — act at the first sign.", hi: "आलू में पछेती झुलसा बहुत विनाशकारी है — पहला संकेत मिलते ही कार्रवाई करें।" },
    symptomKeywords: ["blotch", "blight", "white mold", "rot"],
    source: "ICAR-CPRI advisory / KVK",
  },

  // ---------------------------------------------------------------- CHILLI
  {
    id: "chilli-leaf-curl",
    crop: "chilli",
    type: "disease",
    name: { en: "Chilli leaf curl (virus)", hi: "मिर्च की पत्ती मुड़न (वायरस)" },
    aliases: ["leaf curl", "leaf curl virus", "patti mudan"],
    symptoms: [
      { en: "Leaves curl upward/downward, become small and thick.", hi: "पत्तियाँ मुड़ जाती हैं, छोटी और मोटी हो जाती हैं।" },
      { en: "Plants stay stunted; flowers and fruits drop early.", hi: "पौधे बौने रह जाते हैं; फूल और फल जल्दी गिर जाते हैं।" },
      { en: "Spreads through whiteflies — check for tiny white insects under leaves.", hi: "सफ़ेद मक्खी (whitefly) से फैलता है — पत्तियों के नीचे छोटे सफ़ेद कीड़े देखें।" },
    ],
    management: [
      { en: "Control whiteflies early — they spread the virus.", hi: "सफ़ेद मक्खी को शुरू से ही रोकें — वही वायरस फैलाती है।" },
      { en: "Uproot and destroy badly affected plants to protect the rest.", hi: "ज़्यादा प्रभावित पौधे उखाड़कर नष्ट करें ताकि बाकी फसल बचे।" },
      { en: "Use virus-tolerant varieties; for chemicals follow the current KVK/ICAR advisory.", hi: "वायरस-सहनशील किस्में लगाएँ; दवा के लिए वर्तमान KVK/ICAR सलाह मानें।" },
    ],
    warning: null,
    symptomKeywords: ["curl", "virus", "stunt", "whitefly", "small leaf"],
    source: "ICAR advisory / KVK",
  },

  // ----------------------------------------------------------------- ONION
  {
    id: "onion-purple-blotch",
    crop: "onion",
    type: "disease",
    name: { en: "Purple blotch", hi: "प्याज की बैंगनी धब्बा (Purple blotch)" },
    aliases: ["purple blotch", "alternaria"],
    symptoms: [
      { en: "Purple-brown lesions with lighter centres on leaves.", hi: "पत्तियों पर बैंगनी-भूरे धब्बे जिनका बीच हल्का होता है।" },
      { en: "Leaves wither and fall over in humid weather.", hi: "नम मौसम में पत्तियाँ सूखकर गिर जाती हैं।" },
    ],
    management: [
      { en: "Remove and destroy affected leaves; avoid overhead watering in the evening.", hi: "प्रभावित पत्तियाँ तोड़कर नष्ट करें; शाम को ऊपर से पानी न दें।" },
      { en: "Rotate crops and use disease-free sets/seed.", hi: "फसल चक्र अपनाएँ और रोग-मुक्त बीज/पौधे लगाएँ।" },
      { en: "For spraying, follow the current KVK/ICAR advisory.", hi: "स्प्रे के लिए वर्तमान KVK/ICAR सलाह मानें।" },
    ],
    warning: null,
    symptomKeywords: ["purple", "lesion", "blotch", "wither"],
    source: "ICAR-DOGR advisory / KVK",
  },

  // ------------------------------------------------------------- GROUNDNUT
  {
    id: "groundnut-tikka",
    crop: "groundnut",
    type: "disease",
    name: { en: "Tikka disease (leaf spots)", hi: "मूँगफली का टिक्का रोग (Leaf spots)" },
    aliases: ["tikka", "leaf spot", "cercospora"],
    symptoms: [
      { en: "Small brown to black spots on leaves; spots may join and leaves fall.", hi: "पत्तियों पर छोटे भूरे-काले धब्बे; धब्बे मिलकर पत्तियाँ गिरा देते हैं।" },
      { en: "Worse in humid weather and dense sowing.", hi: "नम मौसम और घनी बुवाई में ज़्यादा होता है।" },
    ],
    management: [
      { en: "Avoid dense sowing; keep the field weed-free.", hi: "घनी बुवाई न करें; खेत खरपतवार-मुक्त रखें।" },
      { en: "Remove and destroy fallen affected leaves.", hi: "गिरी प्रभावित पत्तियाँ इकट्ठा करके नष्ट करें।" },
      { en: "For spraying, follow the current KVK/ICAR advisory.", hi: "स्प्रे के लिए वर्तमान KVK/ICAR सलाह मानें।" },
    ],
    warning: null,
    symptomKeywords: ["spot", "tikka", "brown", "fall"],
    source: "ICAR-DGR advisory / KVK",
  },

  // ------------------------------------------------------- GENERAL NUTRIENT
  {
    id: "general-nitrogen-deficiency",
    crop: "general",
    type: "nutrient",
    name: { en: "Nitrogen deficiency", hi: "नाइट्रोजन की कमी" },
    aliases: ["nitrogen deficiency", "n deficiency", "yellow older leaves"],
    symptoms: [
      { en: "Uniform yellowing starting from the older/lower leaves.", hi: "पुरानी/नीचे की पत्तियों से पीला रंग फैलना।" },
      { en: "Plants look pale, thin and grow slowly.", hi: "पौधे फीके, पतले और धीमे बढ़ते दिखते हैं।" },
    ],
    management: [
      { en: "Confirm with a soil test or local advice before adding fertilizer.", hi: "खाद डालने से पहले मिट्टी की जाँच या स्थानीय सलाह से पुष्टि करें।" },
      { en: "If confirmed, apply nitrogen fertilizer as per the recommended dose for your crop and stage.", hi: "पुष्टि होने पर अपनी फसल और अवस्था के अनुसार अनुशंसित मात्रा में नाइट्रोजन खाद डालें।" },
      { en: "Ask your KVK for the exact dose — it varies by crop and soil.", hi: "सही मात्रा KVK से पूछें — यह फसल और मिट्टी के हिसाब से बदलती है।" },
    ],
    warning: null,
    symptomKeywords: ["yellow", "pale", "nitrogen", "old leaf", "lower leaf"],
    source: "ICAR advisory / KVK",
  },
  {
    id: "general-zinc-deficiency",
    crop: "general",
    type: "nutrient",
    name: { en: "Zinc deficiency", hi: "जिंक की कमी" },
    aliases: ["zinc deficiency", "zn deficiency", "rosette"],
    symptoms: [
      { en: "Yellow-white patches between the veins of young leaves.", hi: "नई पत्तियों की नसों के बीच पीले-सफ़ेद धब्बे।" },
      { en: "Stunted growth with short internodes (rosette) in some crops.", hi: "बौना विकास, गाँठों के बीच कम दूरी (रोज़ेट) कुछ फसलों में।" },
    ],
    management: [
      { en: "Zinc deficiency is common in Rajasthan soils — confirm with a soil test.", hi: "राजस्थान की मिट्टी में जिंक की कमी आम है — मिट्टी जाँच से पुष्टि करें।" },
      { en: "If confirmed, apply zinc as recommended by your KVK (dose varies by crop).", hi: "पुष्टि पर KVK की सलाह के अनुसार जिंक डालें (मात्रा फसल के हिसाब से अलग होती है)।" },
    ],
    warning: null,
    symptomKeywords: ["zinc", "interveinal", "rosette", "yellow patch", "stunt"],
    source: "ICAR advisory / KVK",
  },

  // --------------------------------------------------------- GENERAL STRESS
  {
    id: "general-water-stress",
    crop: "general",
    type: "stress",
    name: { en: "Water stress (dryness)", hi: "पानी की कमी (सूखा तनाव)" },
    aliases: ["water stress", "drought", "wilting", "paani ki kami"],
    symptoms: [
      { en: "Leaves wilt at midday and recover in the evening.", hi: "दोपहर में पत्तियाँ मुरझाती हैं और शाम को ठीक हो जाती हैं।" },
      { en: "Leaves roll or curl; soil is dry and cracked.", hi: "पत्तियाँ मुड़ जाती हैं; मिट्टी सूखी और फटी हुई।" },
    ],
    management: [
      { en: "Check soil moisture by hand before deciding to irrigate.", hi: "पानी देने से पहले हाथ से मिट्टी की नमी जाँचें।" },
      { en: "Irrigate early morning or evening, not in the afternoon heat.", hi: "सुबह जल्दी या शाम को पानी दें, दोपहर की धूप में नहीं।" },
      { en: "Mulch around plants to save soil moisture where practical.", hi: "जहाँ संभव हो, पौधों के पास गीली घास/मल्च डालकर नमी बचाएँ।" },
    ],
    warning: null,
    symptomKeywords: ["wilt", "dry", "curl", "roll", "cracked"],
    source: "ICAR advisory / KVK",
  },
  {
    id: "general-waterlogging",
    crop: "general",
    type: "stress",
    name: { en: "Excess water / waterlogging", hi: "पानी भराव / जल-जमाव" },
    aliases: ["waterlogging", "overwatering", "excess water", "jal jamav"],
    symptoms: [
      { en: "Leaves yellow from the bottom even though the soil is wet.", hi: "मिट्टी गीली होने पर भी नीचे की पत्तियाँ पीली।" },
      { en: "Plants wilt despite wet soil; field has standing water.", hi: "गीली मिट्टी में भी पौधे मुरझाते हैं; खेत में पानी खड़ा है।" },
    ],
    management: [
      { en: "Improve drainage — clear channels so water does not stand.", hi: "निकासी सुधारें — नालियाँ साफ़ करें ताकि पानी न खड़ा रहे।" },
      { en: "Stop irrigating until the field dries out.", hi: "खेत सूखने तक सिंचाई रोकें।" },
      { en: "If yellowing continues after drainage, get a soil/root check from your KVK.", hi: "निकासी के बाद भी पीलापन रहे तो KVK से मिट्टी/जड़ की जाँच करवाएँ।" },
    ],
    warning: null,
    symptomKeywords: ["waterlog", "standing water", "wet", "yellow bottom"],
    source: "ICAR advisory / KVK",
  },
];

// ---------------------------------------------------------------------------
// Matching / verification
// ---------------------------------------------------------------------------

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

function textMatches(needle: string, haystack: string): boolean {
  if (!needle) return false;
  return haystack.includes(needle);
}

export interface VerifiedMatch {
  entry: KnowledgeEntry;
  level: VerificationLevel;
  score: number;
  /** Which condition this verifies. */
  conditionName: string;
}

/**
 * Verify the vision model's suspected conditions against the trusted
 * knowledge base. Returns the single best match (or null when nothing
 * reliably matches). Matching is language-agnostic (aliases + symptom
 * keywords); localization happens when the match is rendered.
 */
export function verifyConditions(
  crop: string | null,
  conditions: SuspectedCondition[]
): { match: VerifiedMatch | null; reasons: string[] } {
  const candidates = conditions.slice(0, 2);
  const scored: VerifiedMatch[] = [];

  for (const cond of candidates) {
    const nameNorm = normalize(cond.name);
    const symptomsNorm = (cond.symptoms_observed ?? [])
      .map(normalize)
      .join(" ");
    let best: { entry: KnowledgeEntry; score: number } | null = null;

    for (const entry of KNOWLEDGE) {
      if (entry.crop !== "general" && crop && entry.crop !== crop) continue;

      let score = 0;
      // Name / alias match.
      const nameHits =
        textMatches(nameNorm, normalize(entry.name.en)) ||
        textMatches(nameNorm, normalize(entry.name.hi)) ||
        entry.aliases.some((a) => textMatches(normalize(a), nameNorm) || textMatches(nameNorm, normalize(a)))
          ? 1
          : 0;
      if (nameHits) score += 3;

      // Symptom keyword overlap between model observations and the entry.
      for (const kw of entry.symptomKeywords) {
        if (textMatches(kw, symptomsNorm)) {
          score += 1;
        }
      }
      if (crop && entry.crop === crop) score += 1;

      if (score > 0 && (!best || score > best.score)) {
        best = { entry, score };
      }
    }

    if (best) {
      const level: VerificationLevel =
        best.score >= 5 ? "verified" : best.score >= 3 ? "likely" : "uncertain";
      scored.push({
        entry: best.entry,
        level,
        score: best.score,
        conditionName: cond.name,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const match = scored[0] ?? null;
  const reasons = scored.map(
    (s) => `${s.conditionName} -> ${s.entry.name.en} (${s.level}, score ${s.score})`
  );
  return { match, reasons };
}

/** Safe generic steps when nothing verifies (both languages). */
export function genericSteps(lang: Lang): string[] {
  return lang === "hi"
    ? [
        "इस फोटो से समस्या की पक्की पहचान नहीं हुई — कृपया साफ़ और पास की फोटो भेजें (पत्ती, तने, फल और पत्ती के नीचे की तरफ़)।",
        "बेहतर फोटो न मिल पाए तो प्रभावित पौधे का नमूना अपने कृषि विज्ञान केंद्र (KVK) में दिखाएँ।",
        "तब तक कोई दवा या रसायन बिना विशेषज्ञ की सलाह के न डालें।",
      ]
    : [
        "This photo does not allow a reliable identification — please send clearer, closer photos (leaf, stem, fruit and the underside of the leaf).",
        "If a better photo is not possible, show a sample of the affected plant to your Krishi Vigyan Kendra (KVK).",
        "Until then, do not apply any chemical without an expert's advice.",
      ];
}

/** Generic source attribution for unverified cases. */
export const GENERIC_SOURCE = "ICAR advisory / KVK (generic)";

export function localizeEntry(
  entry: KnowledgeEntry,
  lang: Lang
): {
  name: string;
  symptoms: string[];
  management: string[];
  warning: string | null;
} {
  const pick = (b: BilingualText) => (lang === "hi" ? b.hi : b.en);
  return {
    name: pick(entry.name),
    symptoms: entry.symptoms.map(pick),
    management: entry.management.map(pick),
    warning: entry.warning ? pick(entry.warning) : null,
  };
}

export function toKnowledgeMatch(
  entry: KnowledgeEntry,
  level: VerificationLevel,
  lang: Lang
): KnowledgeMatch {
  const loc = localizeEntry(entry, lang);
  return {
    conditionId: entry.id,
    conditionName: loc.name,
    crop: entry.crop,
    type: entry.type,
    level,
    symptoms: loc.symptoms,
    management: loc.management,
    warning: loc.warning,
    source: entry.source,
  };
}