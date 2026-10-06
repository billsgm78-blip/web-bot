// api/chat.js - Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY sozlanmagan." });
  }

  const { history } = req.body || {};
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "Noto'g'ri format." });
  }

  // Bir nechta modellarni ketma-ket sinab ko'rish uchun ro'yxat
  const models = [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash"
  ];

  let data = null;
  let success = false;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contents: history }),
      });

      data = await resp.json();

      if (resp.ok) {
        success = true;
        break; // Agar modellar ishlasa, tsiklni to'xtatamiz
      }
    } catch (e) {
      // Keyingi modelga o'tib ketadi
    }
  }

  if (!success) {
    return res.status(503).json({ error: "Hozirda serverlar band. Iltimos, bir ozdan keyin qayta urinib ko'ring." });
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  return res.status(200).json({ text: text || "Javob topilmadi." });
}
