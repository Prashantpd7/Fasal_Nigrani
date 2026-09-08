import type { Lang } from "@/lib/i18n";
import type { ChatReply } from "@/lib/types";

/**
 * DEMO_MODE responder (§34) — CHAT ONLY. Used when no AI key is configured or
 * DEMO_MODE=true, so a live demo can never fail on missing credentials.
 * Crop-photo analysis NEVER uses demo data: without a model key it returns a
 * clear configuration error instead (see /api/analyze-photo).
 */

// ---------------------------------------------------------------------------
// Demo chat responder — small intent matcher, always safe, in both languages.
// ---------------------------------------------------------------------------

function picks(lang: Lang, hi: string, en: string): string {
  return lang === "hi" ? hi : en;
}

export function getDemoChatReply(
  lang: Lang,
  message: string,
  weatherSummary: string | null
): ChatReply {
  const lower = message.toLowerCase();
  const weatherNote = weatherSummary
    ? picks(
        lang,
        `\n\nआपके इलाके का मौसम: ${weatherSummary}`,
        `\n\nYour area's weather: ${weatherSummary}`
      )
    : "";

  // 1) Dosage questions -> always redirect to an expert (§24).
  const asksDose =
    /\b(ml|gm|gms?|gram|dose|dosage)\b/.test(lower) ||
    /(मात्रा|मिली|ग्राम|दवा की मात्रा|कितनी दवा|कितना डालूं|kitni dawai)/.test(
      message
    );
  if (asksDose) {
    return {
      demo: true,
      message: picks(
        lang,
        "सही दवा और उसकी मात्रा खेत की हालत, फसल और बीमारी पर निर्भर करती है — यहाँ बिना देखे बताना सुरक्षित नहीं है। अपने कृषि विज्ञान केंद्र या किसी कृषि विशेषज्ञ से मिलकर ही दवा डालें। वे खेत देखकर सही सलाह देंगे।",
        "The right chemical and its dose depend on the crop, the disease and your field — guessing here would not be safe. Please consult your Krishi Vigyan Kendra or an agriculture expert, who can see the field and advise correctly."
      ),
    };
  }

  // 2) Spray today or not (weather-aware when available).
  if (/(spray|छिड़काव|स्प्रे|chhidkav)/.test(lower)) {
    return {
      demo: true,
      message:
        picks(
          lang,
          "स्प्रे करने से पहले दो बातें देखें: (1) आज-कल बारिश की संभावना ज़्यादा है तो टालें — बारिश दवा धो देगी; (2) हवा तेज़ है तो भी टालें — दवा उड़ जाएगी। अगर कीड़े या बीमारी फैल रही है और मौसम ठीक है, तो सुबह के समय ही स्प्रे करें। दवा कौन-सी और कितनी, यह विशेषज्ञ से पूछें।",
          "Before spraying check two things: (1) if rain is likely today or tomorrow, wait — rain washes the chemical away; (2) if wind is strong, wait — the spray drifts away. If pests or disease are spreading and weather is calm, spray in the early morning. Ask an expert which chemical and how much."
        ) + weatherNote,
    };
  }

  // 3) Irrigation timing.
  if (/(panni|paani|सिंचाई|पानी|irrigat|water)/.test(lower)) {
    return {
      demo: true,
      message:
        picks(
          lang,
          "पानी देने का सबसे अच्छा समय सुबह जल्दी या शाम को है, दोपहर की धूप में नहीं। अगर आज या कल बारिश की संभावना है तो पानी टाल दें। गेहूँ/सरसों/बाजरा जैसी फसल में पानी ज़रूरत के हिसाब से दें — हर रोज़ नहीं। खेत में पानी न भरने दें।",
          "The best time to water is early morning or evening, never in the afternoon heat. If rain is expected today or tomorrow, skip watering. Give water by need (wheat/mustard/bajra do not need daily watering) and never let the field stay flooded."
        ) + weatherNote,
    };
  }

  // 4) Yellow leaves.
  if (/(peeli|पीली|yellow)/.test(lower)) {
    return {
      demo: true,
      message: picks(
        lang,
        "पत्तियों का पीला होना कई वजहों से हो सकता है: पानी की कमी या ज़्यादा पानी, खाद (नाइट्रोजन) की कमी, या कोई बीमारी। पहले जाँचें: मिट्टी सूखी तो हल्का पानी दें; पानी भरा है तो निकासी करें। अगर पीलापन फैल रहा है या पत्तियों पर धब्बे हैं, तो 'फसल की फोटो जाँच' से फोटो भेजें या विशेषज्ञ को दिखाएँ।",
        "Yellow leaves can come from many causes: too little or too much water, lack of fertilizer (nitrogen), or a disease. First check: if soil is dry, water lightly; if the field is waterlogged, drain it. If yellowing spreads or spots appear, send a photo through 'Check a Crop Photo' or show an expert."
      ),
    };
  }

  // 5) Disease / pest help.
  if (/(bimari|बीमारी|keede|कीड़े|keet|कीट|disease|pest|fungus|dhabbe|धब्बे|dhaage)/.test(lower)) {
    return {
      demo: true,
      message: picks(
        lang,
        "बीमारी या कीड़ों की पहचान फोटो देखकर सबसे अच्छी होती है। ऊपर 'फसल की फोटो जाँच' पर जाकर प्रभावित पत्ती की साफ़ फोटो भेजें — हम पहली राय देंगे। याद रखें: कोई भी दवा बिना विशेषज्ञ की सलाह के न डालें, गलत दवा से नुकसान और बढ़ सकता है।",
        "The best way to identify a disease or pest is by looking at it. Go to 'Check a Crop Photo' above and send a clear photo of the affected leaf — we will give a first opinion. Remember: never apply any chemical without expert advice — the wrong one can make things worse."
      ),
    };
  }

  // 6) Very short / vague input -> one clarifying question.
  if (message.trim().length < 8) {
    return {
      demo: true,
      message: picks(
        lang,
        "कृपया थोड़ा और बताएँ — कौन-सी फसल है (गेहूँ, सरसों, बाजरा, कपास…)? समस्या क्या दिख रही है — पत्तियाँ पीली, धब्बे, कीड़े या पानी की दिक्कत?",
        "Please tell me a little more — which crop is it (wheat, mustard, bajra, cotton…)? And what do you see — yellow leaves, spots, pests or a water problem?"
      ),
    };
  }

  // 7) Generic fallback.
  return {
    demo: true,
    message: picks(
      lang,
      "मैं आपकी मदद करने की कोशिश करूँगा। कृपया तीन बातें बताएँ: (1) कौन-सी फसल और उसकी उम्र, (2) समस्या कब से और कैसी दिख रही है (पत्ती/तना/फल पर क्या बदला), (3) आपका इलाका। ज़्यादा जानकारी से सलाह ज़्यादा सही होगी। अगर फोटो भेजना हो तो 'फसल की फोटो जाँच' इस्तेमाल करें।",
      "I will try to help. Please tell me three things: (1) which crop and its age, (2) since when and how the problem looks (what changed on leaf/stem/fruit), (3) your area. More detail means better advice. To send a photo, use 'Check a Crop Photo'."
    ),
  };
}
