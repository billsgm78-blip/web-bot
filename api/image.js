export const maxDuration = 60;

// Rasm yaratish: avval bot serverida pul yechiladi, rasm chiqmasa avtomatik qaytariladi.
const RAILWAY_URL = (process.env.RAILWAY_URL || "https://ai2-production-7d7e.up.railway.app").replace(/\/$/, "");
const IMAGE_MODELS = ["google/gemini-2.5-flash-image", "google/gemini-2.5-flash-image-preview"];

async function railway(path, body) {
  const r = await fetch(`${RAILWAY_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  j._status = r.status;
  return j;
}

// 1-usul: OpenRouter'ning maxsus /images yo'li
async function viaImagesEndpoint(apiKey, prompt) {
  for (const model of IMAGE_MODELS) {
    const r = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://bilolsai.uz", "X-Title": "Bilols AI" },
      body: JSON.stringify({ model, prompt })
    });
    if (!r.ok) continue;
    const j = await r.json().catch(() => null);
    const item = j?.data?.[0];
    if (item?.b64_json) return `data:${item.media_type || "image/png"};base64,${item.b64_json}`;
    if (item?.url) return item.url;
  }
  return null;
}

// 2-usul: chat orqali (modalities: image)
async function viaChat(apiKey, prompt) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://bilolsai.uz", "X-Title": "Bilols AI" },
    body: JSON.stringify({ model: IMAGE_MODELS[0], models: IMAGE_MODELS, modalities: ["image", "text"], messages: [{ role: "user", content: prompt }] })
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const msg = j?.choices?.[0]?.message;
  const url = msg?.images?.[0]?.image_url?.url;
  return url || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const { phone, password, prompt } = req.body || {};
  const text = String(prompt || "").trim().slice(0, 1500);
  if (!apiKey) return res.status(500).json({ error: "API kaliti sozlanmagan." });
  if (!text) return res.status(400).json({ error: "Rasm tavsifini yozing." });

  const charge = await railway("/api/image-charge", { phone, password });
  if (charge._status === 403) return res.status(401).json({ error: "Iltimos, hisobdan chiqib qayta kiring.", needLogin: true });
  if (!charge.success) return res.status(402).json({ error: charge.error || "Mablag' yetarli emas", noMoney: true, price: charge.price, balance: charge.balance });

  let image = null;
  try {
    image = await viaImagesEndpoint(apiKey, text);
    if (!image) image = await viaChat(apiKey, text);
  } catch (e) {
    image = null;
  }

  if (!image) {
    const refund = await railway("/api/image-refund", { txId: charge.txId, refundToken: charge.refundToken }).catch(() => ({}));
    return res.status(502).json({ error: "Rasm yaratib bo'lmadi. Pul balansingizga qaytarildi.", refunded: !!refund.success, balance: refund.balance });
  }
  return res.status(200).json({ image, balance: charge.balance });
}
