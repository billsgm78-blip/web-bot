// api/register.js - Vercel Serverless Function

export default async function handler(req, res) {
  // CORS sozlamalari
  res.setHeader("Access-Control-Allow-Credentials", true);
  {
    const o = String(req.headers.origin || "");
    const ok = /^https:\/\/((www\.)?bilolsai\.uz|web-bot(-[a-z0-9-]+)?\.vercel\.app|[a-z0-9-]+-billsgm78-blips-projects\.vercel\.app|appassets\.androidplatform\.net)$/.test(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
    res.setHeader("Access-Control-Allow-Origin", ok ? o : "https://bilolsai.uz");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Expose-Headers", "X-Balance, X-Quota-Left");
    if (o && !ok) { res.status(403).json({ error: "Ruxsat yo'q." }); return; }
  }
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

  // Railway backend manzili
  const backendUrl = "https://ai2-production-7d7e.up.railway.app"; 

  try {
    // Vercel'ga kelgan barcha ma'lumotlarni (telefon, parol, ism, kod, action) 
    // to'g'ridan-to'g'ri Railway'dagi bot serveriga yo'naltiramiz
    const dbResp = await fetch(`${backendUrl}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const dbData = await dbResp.json().catch(() => ({}));

    if (!dbResp.ok) {
      // needBot/botUrl: foydalanuvchi botga hali kirmagan bo'lsa, sayt "Botga o'tish" tugmasini ko'rsatadi
      return res.status(dbResp.status).json({
        error: dbData.error || "Xatolik yuz berdi.",
        needBot: dbData.needBot,
        botUrl: dbData.botUrl,
      });
    }

    return res.status(200).json(dbData);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Xatolik yuz berdi. Qaytadan urinib ko'ring." });
  }
}
