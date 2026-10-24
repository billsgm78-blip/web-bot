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

// Rasmni tahrirlash: asl rasm + ko'rsatma (fonni olib tashla, multfilm qil...) -> yangi rasm
async function viaChatEdit(apiKey, instruction, image) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://bilolsai.uz", "X-Title": "Bilols AI" },
    body: JSON.stringify({
      model: IMAGE_MODELS[0], models: IMAGE_MODELS, modalities: ["image", "text"],
      messages: [{ role: "user", content: [
        { type: "text", text: `Edit this image: ${instruction}. Keep everything else in the image unchanged unless the instruction says otherwise. Return the edited image.` },
        { type: "image_url", image_url: { url: image } }
      ] }]
    })
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    lastError = `openrouter/edit ${r.status}: ${e?.error?.message || ""}`.slice(0, 300);
    return null;
  }
  const j = await r.json().catch(() => null);
  return j?.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

// Pollinations kaliti (POLLINATIONS_TOKEN) bo'lsa: haqiqiy tahrirlash — Nano Banana, bo'lmasa FLUX Kontext, GPT-Image mini
const POLL_EDIT_MODELS = (process.env.POLLINATIONS_EDIT_MODELS || "google/gemini-nano-banana-2.1,black-forest-labs/flux.1-kontext-pro,openai/gpt-image-1-mini")
  .split(",").map(x => x.trim()).filter(Boolean);
async function viaPollinationsEdit(instruction, image, deadline) {
  const token = (process.env.POLLINATIONS_TOKEN || "").trim();
  if (!token) return null;
  for (const model of POLL_EDIT_MODELS) {
    if (Date.now() + 8000 > deadline) break;
    const body = JSON.stringify({ model, prompt: `${instruction}. Keep everything else in the image unchanged.`, image: [{ image_url: image }] });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.max(5000, deadline - Date.now()));
    try {
      const r = await fetch("https://gen.pollinations.ai/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body, signal: ctrl.signal });
      const j = await r.json().catch(() => null);
      if (!r.ok) { lastError += ` | poll-edit ${model} ${r.status}: ${String(j?.error?.message || "").slice(0, 120)}`; continue; }
      const item = j?.data?.[0];
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) {
        const ir = await fetch(item.url, { signal: ctrl.signal });
        const type = ir.headers.get("content-type") || "image/png";
        if (ir.ok && type.startsWith("image/")) return `data:${type.split(";")[0]};base64,${Buffer.from(await ir.arrayBuffer()).toString("base64")}`;
      }
      lastError += ` | poll-edit ${model} empty`;
    } catch (e) {
      lastError += ` | poll-edit ${model} ${e.name || "error"}`;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// Bepul zaxira: bepul ko'ruvchi model rasmni tasvirlaydi (o'zgarish bilan), keyin Pollinations qaytadan chizadi
async function describeForEdit(apiKey, image, instruction) {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://bilolsai.uz", "X-Title": "Bilols AI" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", max_tokens: 300,
        messages: [{ role: "user", content: [
          { type: "text", text: "Write a detailed English prompt for an image generator that recreates this image as closely as possible " +
            "(composition, subjects, background, colors, lighting, style, camera angle), but with this change applied: \"" + instruction + "\". " +
            "Describe only the final edited image, do not mention the change or the original. Output only the prompt, max 110 words." },
          { type: "image_url", image_url: { url: image } }
        ] }]
      })
    });
    if (!r.ok) { lastError += ` | describe ${r.status}`; return ""; }
    const j = await r.json().catch(() => null);
    return String(j?.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");
  } catch (e) {
    lastError += ` | describe ${e.name || "error"}`;
    return "";
  }
}

// Tahrirlash ko'rsatmasini inglizchaga o'giradi
async function toEnglishInstruction(apiKey, text) {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://bilolsai.uz", "X-Title": "Bilols AI" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", max_tokens: 200,
        messages: [{ role: "user", content: `Translate this photo-editing instruction into short, precise English. Output only the instruction.\n\n${text}` }]
      })
    });
    if (!r.ok) return "";
    const j = await r.json().catch(() => null);
    return String(j?.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");
  } catch (e) {
    return "";
  }
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
// Bepul Pollinations ba'zan "band" (503/429) javob beradi — qisqa kutib qayta uriniladi (Vercel 60 soniya chegarasi ichida)
async function viaPollinations(prompt, size, deadline = Date.now() + 50000) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await pollinationsOnce(prompt, size, Math.max(5000, deadline - Date.now()));
    if (r.image || !r.busy) return r.image;
    const wait = Math.min(20000, Math.max(3000, (r.retryAfter || 6) * 1000 + 500));
    if (Date.now() + wait + 8000 > deadline) return null;
    await new Promise(ok => setTimeout(ok, wait));
  }
  return null;
}

async function pollinationsOnce(prompt, size, timeoutMs) {
  const token = (process.env.POLLINATIONS_TOKEN || "").trim();
  const params = new URLSearchParams({ width: String(size?.w || 1024), height: String(size?.h || 1024), referrer: "bilolsai.uz", seed: String(Math.floor(Math.random() * 1e9)) });
  if (token) { params.set("nologo", "true"); params.set("model", process.env.POLLINATIONS_IMAGE_MODEL || "zimage"); }
  // Kalit bo'lsa — yangi API (limitsiz), bo'lmasa — bepul "Classic" API (IP bo'yicha 45 soniyada 1 ta)
  const url = token ? `https://gen.pollinations.ai/image/${encodeURIComponent(prompt.slice(0, 900))}?${params}`
    : `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?${params}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.min(45000, timeoutMs || 45000));
  try {
    const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: ctrl.signal });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) {
      // Bepul limit: "1 image every 45 seconds per IP. Retry after 8s" — kutib qayta urinish mumkin
      const body = await r.text().catch(() => "");
      const freeLimit = /FREE_LIMIT|at its limit|Retry after/i.test(body);
      const m = body.match(/Retry after (\d+)\s*s/i);
      lastError += ` | pollinations ${r.status}${freeLimit ? " limit" : ""}`;
      return { image: null, busy: r.status === 503 || r.status === 429 || freeLimit, retryAfter: m ? +m[1] : 0 };
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1000) return { image: null };
    return { image: `data:${type.split(";")[0]};base64,${buf.toString("base64")}` };
  } catch (e) {
    lastError += ` | pollinations ${e.name || "error"}`;
    return { image: null };
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
  const { phone, password, prompt, image: srcImage, aspect } = req.body || {};
  const text = String(prompt || "").trim().slice(0, 1500);
  if (!apiKey) return res.status(500).json({ error: "API kaliti sozlanmagan." });
  if (!text) return res.status(400).json({ error: srcImage ? "Rasmni qanday o'zgartirish kerakligini yozing." : "Rasm tavsifini yozing." });
  const isEdit = typeof srcImage === "string" && srcImage.length > 0;
  if (isEdit && (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(srcImage) || srcImage.length > 4_000_000)) {
    return res.status(400).json({ error: "Rasm formati noto'g'ri yoki juda katta." });
  }

  // Pul yechiladi va tavsif botning Google Gemini kaliti bilan inglizchaga o'giriladi
  const charge = await railway("/api/image-charge", { phone, password, prompt: text }, /appassets\.androidplatform\.net/.test(String(req.headers.origin || "")) ? "app" : "web");
  if (charge._status === 403) return res.status(401).json({ error: "Iltimos, hisobdan chiqib qayta kiring.", needLogin: true });
  if (charge.blocked) return res.status(503).json({ error: charge.message || "Bu funksiya vaqtincha o'chirilgan.", blocked: true });
  if (!charge.success) return res.status(402).json({ error: charge.error || "Mablag' yetarli emas", noMoney: true, price: charge.price, balance: charge.balance });

  let image = null;
  lastError = "";
  const deadline = Date.now() + 48000;
  if (isEdit) {
    const instr = await toEnglishInstruction(apiKey, text) || text;
    try { image = await viaChatEdit(apiKey, instr, srcImage); } catch (e) { lastError += ` | ${e.message || e}`; }
    let approx = false;
    if (!image) image = await viaPollinationsEdit(instr, srcImage, deadline);
    // Taxminiy "tasvirlab qayta chizish" faqat Pollinations kaliti yo'q paytda (kalit bo'lsa — haqiqiy tahrir yoki pul qaytariladi)
    if (!image && !(process.env.POLLINATIONS_TOKEN || "").trim()) {
      // OpenRouter rasm chiqara olmadi (masalan, balans 1$ dan kam) — bepul usul: tasvirlab, qaytadan chizish
      const desc = await describeForEdit(apiKey, srcImage, instr);
      if (desc) {
        const a = Math.max(0.5, Math.min(2, Number(aspect) || 1));
        const size = a >= 1 ? { w: 1024, h: Math.round(1024 / a / 64) * 64 } : { w: Math.round(1024 * a / 64) * 64, h: 1024 };
        image = await viaPollinations(desc, size, deadline);
        approx = !!image;
      }
    }
    if (lastError) console.error("image edit:", lastError);
    if (!image) {
      const refund = await railway("/api/image-refund", { txId: charge.txId, refundToken: charge.refundToken }).catch(() => ({}));
      return res.status(502).json({ error: "Rasmni tahrirlab bo'lmadi. Pul balansingizga qaytarildi.", refunded: !!refund.success, balance: refund.balance });
    }
    return res.status(200).json({ image, balance: charge.balance, approx });
  }
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
  if (!image) image = await viaPollinations(enPrompt, null, deadline);
  if (lastError) console.error("image:", lastError);

  if (!image) {
    const refund = await railway("/api/image-refund", { txId: charge.txId, refundToken: charge.refundToken }).catch(() => ({}));
    return res.status(502).json({ error: "Rasm yaratib bo'lmadi. Pul balansingizga qaytarildi.", refunded: !!refund.success, balance: refund.balance });
  }
  return res.status(200).json({ image, balance: charge.balance });
}
