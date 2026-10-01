// api/register.js - Vercel Serverless Function

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

  const token = (process.env.BOT_TOKEN || "").trim();
  const adminId = (process.env.ADMIN_CHAT_ID || "").trim();

  if (!token || !adminId) {
    return res.status(500).json({ error: "BOT_TOKEN yoki ADMIN_CHAT_ID sozlanmagan." });
  }

  const { name, phone } = req.body || {};

  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ error: "Telefon raqami kiritilmadi yoki noto'g'ri format." });
  }

  const text =
    `🆕 Yangi ro'yxatdan o'tish (veb-sayt)!\n` +
    `Ism: ${name && String(name).trim() ? String(name).trim() : "-"}\n` +
    `Telefon: ${String(phone).trim()}`;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: adminId, text }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: errData.description || "Telegram xatoligi" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
