// api/chat.js - Vercel Serverless Function

const MODELS = [
  process.env.GEMINI_MODEL || "gemini-1.5-flash",
  "gemini-1.5-pro",
];

const RETRY_STATUSES = [429, 500, 503, 504];
const ATTEMPTS_PER_MODEL = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  // CORS sozlamalari
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Faqat POST so'rov qabul qilinadi." });
  }

  const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY sozlanmagan." });
  }

  const { history } = req.body || {};
  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: "Noto'g'ri so'rov formati yoki bo'sh xabar." });
  }

  const payload = JSON.stringify({ contents: history });
  let lastStatus = 500;

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: payload,
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok) {
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const text = parts.map((p) => p.text || "").join("").trim();
          return res.status(200).json({ text: text || "Javob topilmadi." });
        }

        lastStatus = resp.status;
        console.error(`Gemini xato [${model}] ${resp.status}:`, data?.error?.message);

        if (resp.status === 401 || resp.status === 403) {
          return res.status(500).json({
            error: "Server sozlamasida xatolik (API kalit). Iltimos, keyinroq urinib ko'ring.",
          });
        }

        if (resp.status === 404) break;

        if (RETRY_STATUSES.includes(resp.status)) {
          if (attempt < ATTEMPTS_PER_MODEL) await sleep(600 * attempt);
          continue;
        }

        return res.status(resp.status).json({ error: "So'rovni qayta ishlab bo'lmadi." });
      } catch (e) {
        console.error(`Tarmoq xatosi [${model}]:`, String(e));
        lastStatus = 500;
        if (attempt < ATTEMPTS_PER_MODEL) await sleep(600 * attempt);
      }
    }
  }

  return res.status(lastStatus === 429 ? 429 : 503).json({
    error: "Hozir server band. Birozdan keyin qayta urinib ko'ring.",
  });
}
