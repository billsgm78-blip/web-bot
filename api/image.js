export const maxDuration = 60;

// Rasm yaratish: avval bot serverida pul yechiladi, rasm chiqmasa avtomatik qaytariladi.
const RAILWAY_URL = (process.env.RAILWAY_URL || "https://ai2-production-7d7e.up.railway.app").replace(/\/$/, "");
const IMAGE_MODELS = ["google/gemini-2.5-flash-image", "google/gemini-2.5-flash-image-preview"];

async function railway(path, body, client) {
  const r = await fetch(`${RAILWAY_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bilols-Client": client || "web" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  j._status = r.status;
  return j;
}

let lastError = "";

// 1-usul: OpenRouter'ning maxsus /images yo'li
async function viaImagesEndpoint(apiKey, prompt) {
  for (const model of IMAGE_MODELS) {
    const r = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://bilolsai.uz", "X-Title": "Bilols AI" },
      body: JSON.stringify({ model, prompt })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      lastError = `openrouter/images ${r.status}: ${e?.error?.message || ""}`.slice(0, 300);
      continue;
    }
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
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    lastError = `openrouter/chat ${r.status}: ${e?.error?.message || ""}`.slice(0, 300);
    return null;
  }
  const j = await r.json().catch(() => null);
  const msg = j?.choices?.[0]?.message;
  const url = msg?.images?.[0]?.image_url?.url;
  return url || null;
}

// Tavsifni ingliz tiliga o'giramiz (rasm modellari inglizchani yaxshi tushunadi). Xato bo'lsa — asl matn.
async function toEnglishPrompt(apiKey, text) {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://bilolsai.uz", "X-Title": "Bilols AI" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 200,
        messages: [{ role: "user", content: `Rewrite this image request as a short, vivid English prompt for an image generator. Output only the prompt.\n\n${text}` }]
      })
    });
    if (!r.ok) return "";
    const j = await r.json().catch(() => null);
    return String(j?.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");
  } catch (e) {
    return "";
  }
}

// Zaxira tarjima: Pollinations matn xizmati (bepul)
async function toEnglishViaPollinations(text) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const ask = `Translate to a short English image prompt, output only the prompt: ${text}`;
    const r = await fetch(`https://text.pollinations.ai/${encodeURIComponent(ask.slice(0, 600))}?referrer=bilolsai.uz`, { signal: ctrl.signal });
    if (!r.ok) return "";
    const out = (await r.text()).trim().replace(/^["']|["']$/g, "");
    return out.length > 2 && out.length < 900 ? out : "";
  } catch (e) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

// 3-usul (zaxira): Pollinations — bepul. POLLINATIONS_TOKEN bo'lsa, cheklov yuqoriroq va suv belgisisiz.
async function viaPollinations(prompt) {
  const token = (process.env.POLLINATIONS_TOKEN || "").trim();
  const params = new URLSearchParams({ width: "1024", height: "1024", model: "flux", referrer: "bilolsai.uz", seed: String(Math.floor(Math.random() * 1e9)) });
  if (token) params.set("nologo", "true");
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?${params}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: ctrl.signal });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) {
      lastError += ` | pollinations ${r.status}`;
      return null;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1000) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch (e) {
    lastError += ` | pollinations ${e.name || "error"}`;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  {
    const o = String(req.headers.origin || "");
    const ok = /^https:\/\/((www\.)?bilolsai\.uz|web-bot(-[a-z0-9-]+)?\.vercel\.app|[a-z0-9-]+-billsgm78-blips-projects\.vercel\.app|appassets\.androidplatform\.net)$/.test(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
    res.setHeader("Access-Control-Allow-Origin", ok ? o : "https://bilolsai.uz");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Expose-Headers", "X-Balance, X-Quota-Left");
    if (o && !ok) { res.status(403).json({ error: "Ruxsat yo'q." }); return; }
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const { phone, password, prompt } = req.body || {};
  const text = String(prompt || "").trim().slice(0, 1500);
  if (!apiKey) return res.status(500).json({ error: "API kaliti sozlanmagan." });
  if (!text) return res.status(400).json({ error: "Rasm tavsifini yozing." });

  // Pul yechiladi va tavsif botning Google Gemini kaliti bilan inglizchaga o'giriladi
  const charge = await railway("/api/image-charge", { phone, password, prompt: text }, /appassets\.androidplatform\.net/.test(String(req.headers.origin || "")) ? "app" : "web");
  if (charge._status === 403) return res.status(401).json({ error: "Iltimos, hisobdan chiqib qayta kiring.", needLogin: true });
  if (charge.blocked) return res.status(503).json({ error: charge.message || "Bu funksiya vaqtincha o'chirilgan.", blocked: true });
  if (!charge.success) return res.status(402).json({ error: charge.error || "Mablag' yetarli emas", noMoney: true, price: charge.price, balance: charge.balance });

  let image = null;
  lastError = "";
  const enPrompt = (charge.prompt || "").trim()
    || await toEnglishPrompt(apiKey, text)
    || await toEnglishViaPollinations(text)
    || text;
  if (enPrompt === text) lastError += " | tarjima ishlamadi";
  try {
    image = await viaImagesEndpoint(apiKey, enPrompt);
    if (!image) image = await viaChat(apiKey, enPrompt);
  } catch (e) {
    lastError += ` | ${e.message || e}`;
    image = null;
  }
  if (!image) image = await viaPollinations(enPrompt);
  if (lastError) console.error("image:", lastError);

  if (!image) {
    const refund = await railway("/api/image-refund", { txId: charge.txId, refundToken: charge.refundToken }).catch(() => ({}));
    return res.status(502).json({ error: "Rasm yaratib bo'lmadi. Pul balansingizga qaytarildi.", refunded: !!refund.success, balance: refund.balance });
  }
  return res.status(200).json({ image, balance: charge.balance });
}
