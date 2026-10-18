export const maxDuration = 60;

// Botning serveri (balans, obuna va kunlik limit shu yerda hisoblanadi)
const RAILWAY_URL = (process.env.RAILWAY_URL || "https://ai2-production-7d7e.up.railway.app").replace(/\/$/, "");

const QUOTA_MSG = {
  uz: (n) => `Bugungi ${n} ta bepul xabar tugadi. Cheksiz yozish uchun obuna oling yoki ertaga qayting.`,
  ru: (n) => `Бесплатные ${n} сообщений на сегодня закончились. Оформите подписку для безлимита или возвращайтесь завтра.`,
  en: (n) => `You've used today's ${n} free messages. Get a subscription for unlimited chat or come back tomorrow.`
};
const LOGIN_MSG = {
  uz: "Iltimos, hisobdan chiqib qayta kiring.",
  ru: "Пожалуйста, выйдите из аккаунта и войдите снова.",
  en: "Please log out and log in again."
};

// Har bir xabardan oldin limitni tekshiradi. Bot serveri javob bermasa, chat to'xtab qolmasligi uchun ruxsat beriladi.
async function checkQuota(phone, password) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(`${RAILWAY_URL}/api/chat-quota`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
      signal: ctrl.signal
    });
    if (r.status === 403) return { allowed: false, needLogin: true };
    const j = await r.json().catch(() => ({}));
    if (!j.success) return { allowed: true };
    return j;
  } catch (e) {
    return { allowed: true, offline: true };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "API kaliti sozlanmagan." });
  }

  const { history, lang, stream, phone, password } = req.body || {};
  const wantStream = stream === true;
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "Noto'g'ri format." });
  }

  // Saytning interfeys tili (faqat shu uchta qiymat qabul qilinadi)
  const LANG_NAMES = { uz: "Uzbek", ru: "Russian", en: "English" };
  const uiLang = LANG_NAMES[lang] ? lang : "uz";

  if (!phone || !password) {
    return res.status(401).json({ error: LOGIN_MSG[uiLang], needLogin: true });
  }
  const quota = await checkQuota(String(phone), String(password));
  if (quota.needLogin) {
    return res.status(401).json({ error: LOGIN_MSG[uiLang], needLogin: true });
  }
  if (!quota.allowed && quota.maintenance) {
    return res.status(503).json({ error: "🛠 " + (quota.message || "Texnik ishlar olib borilmoqda."), maintenance: true });
  }
  if (!quota.allowed) {
    return res.status(429).json({ error: QUOTA_MSG[uiLang](quota.limit || ""), limitReached: true, limit: quota.limit, subPrice: quota.subPrice });
  }
  if (!quota.unlimited && typeof quota.left === "number") {
    res.setHeader("X-Quota-Left", String(quota.left));
  }

  // O'zbek, Rus va Ingliz tillarini avtomatik aniqlab javob beruvchi tizim ko'rsatmasi
  const messages = [
    {
      role: "system",
      content:
        "You are Bilols AI, an intelligent neural assistant. Always detect and reply in the language used by the user: if the user writes in English, reply fluently and naturally in English; if the user writes in Russian, reply in natural and fluent Russian; if the user writes in Uzbek, reply in natural and fluent Uzbek. If an image is provided, analyze and describe its contents, equations, or tasks thoroughly in the user's language. " +
        `If the language of the user's message is unclear (for example, only an image or a very short message), reply in ${LANG_NAMES[uiLang]}.`
    }
  ];

  let requestContainsImage = false;

  // TEZLIK: faqat oxirgi 12 ta xabarni yuboramiz (tarix o'sib ketmasin)
  let recent = history.slice(-12);
  while (recent.length && recent[0].role === "model") recent.shift();

  // TEZLIK: faqat eng oxirgi rasm qoladi, eskilari tashlab yuboriladi
  let lastImageIdx = -1;
  recent.forEach((h, i) => {
    if (Array.isArray(h.parts) && h.parts.some(p => p.inline_data)) lastImageIdx = i;
  });

  recent.forEach((h, idx) => {
    let role = h.role === "model" ? "assistant" : h.role;
    let parts = [];

    if (h.parts && Array.isArray(h.parts)) {
      h.parts.forEach(p => {
        if (p.text) {
          parts.push({ type: "text", text: p.text });
        } else if (p.inline_data && idx === lastImageIdx) {
          requestContainsImage = true;
          parts.push({
            type: "image_url",
            image_url: {
              url: `data:${p.inline_data.mime_type || "image/jpeg"};base64,${p.inline_data.data}`
            }
          });
        }
      });
    }

    if (parts.length > 0) {
      messages.push({ role, content: parts });
    }
  });

  // OpenRouter qoidasi: ko'pi bilan 3 ta model bo'lishi shart.
  // TEZLIK: "openrouter/auto" o'rniga tez modellar ro'yxati (birinchisi ishlamasa, keyingisiga o'tadi).
  const FAST_MODELS = [
    "google/gemini-2.0-flash-001",
    "google/gemini-2.5-flash",
    "openai/gpt-4o-mini"
  ];
  const VISION_MODELS = [
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash-001",
    "openai/gpt-4o-mini"
  ];
  const modelList = requestContainsImage ? VISION_MODELS : FAST_MODELS;

  const requestBody = {
    model: modelList[0],
    models: modelList,
    messages: messages,
    max_tokens: 3000
  };
  if (wantStream) requestBody.stream = true;

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bilolsai.uz",
        "X-Title": "Bilols AI"
      },
      body: JSON.stringify(requestBody)
    });

    if (wantStream && resp.ok && resp.body) {
      // Javobni bo'lak-bo'lak yuboramiz: foydalanuvchi matnni yozilib borayotganini ko'radi
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no"
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let wrote = false;
      let streamError = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            if (j.error) streamError = j.error.message || "Model xatoligi yuz berdi.";
            const piece = j?.choices?.[0]?.delta?.content;
            if (piece) {
              res.write(piece);
              wrote = true;
            }
          } catch (e) {}
        }
      }
      if (!wrote) res.write(streamError || "Javob olib bo'lmadi. Iltimos, qayta urinib ko'ring.");
      return res.end();
    }

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.error?.message || "Model xatoligi yuz berdi."
      });
    }

    let text = data?.choices?.[0]?.message?.content || "";

    text = text
      .replace(/User Safety:[\s\S]*?(?=\n\n|$)/gi, "")
      .replace(/Response Safety:[\s\S]*?(?=\n\n|$)/gi, "")
      .trim();

    if (!text) {
      text = "Javob olib bo'lmadi. Iltimos, qayta urinib ko'ring.";
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: "Server bilan bog'lanishda xatolik yuz berdi." });
  }
}