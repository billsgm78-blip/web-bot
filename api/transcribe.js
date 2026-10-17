export const maxDuration = 60;

// Ovozli xabarni matnga aylantirish (Telegram mini app'da ham ishlaydi).
const RAILWAY_URL = (process.env.RAILWAY_URL || "https://ai2-production-7d7e.up.railway.app").replace(/\/$/, "");
const MODELS = ["google/gemini-2.5-flash", "google/gemini-2.0-flash-001"];
const MAX_B64 = 3_500_000; // ~60 soniya 16 kHz WAV

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const { phone, password, audio, lang } = req.body || {};
  if (!apiKey) return res.status(500).json({ error: "API kaliti sozlanmagan." });
  if (!audio || typeof audio !== "string") return res.status(400).json({ error: "Ovoz topilmadi." });
  if (audio.length > MAX_B64) return res.status(413).json({ error: "Ovoz juda uzun (60 soniyagacha)." });

  // Faqat kirgan foydalanuvchilar uchun
  try {
    const r = await fetch(`${RAILWAY_URL}/api/auth-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password })
    });
    if (r.status === 403) return res.status(401).json({ error: "Iltimos, qayta kiring.", needLogin: true });
  } catch (e) {
    // bot serveri vaqtincha javob bermasa ham davom etamiz
  }

  const hint = { uz: "Uzbek", ru: "Russian", en: "English" }[lang] || "Uzbek";
  const body = {
    model: MODELS[0],
    models: MODELS,
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `Transcribe this voice message word for word in the language it is spoken (usually Uzbek, Russian or English; the app language is ${hint}). Write Uzbek in the Latin alphabet. Output only the transcript — no quotes, no comments. If there is no speech, output nothing.`
        },
        { type: "input_audio", input_audio: { data: audio, format: "wav" } }
      ]
    }]
  };

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://bilolsai.uz", "X-Title": "Bilols AI" },
      body: JSON.stringify(body)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return res.status(502).json({ error: data?.error?.message || "Ovozni tanib bo'lmadi." });
    const text = String(data?.choices?.[0]?.message?.content || "").trim().replace(/^["«]|["»]$/g, "");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Server bilan bog'lanishda xatolik." });
  }
}
