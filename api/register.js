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

  const { name, phone, password } = req.body || {};

  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ error: "Telefon raqami kiritilmadi yoki noto'g'ri format." });
  }

  const cleanPhone = String(phone).replace(/[^0-9]/g, "");
  
  // Render'dagi backend botingizning asosiy URL manzilini shu yerga yozing (masalan: https://inglizcha-nom.onrender.com)
  const backendUrl = "https://SIZNING-RENDER-DOMENINGIZ.onrender.com"; 

  try {
    // 1. Render'dagi Python bot bazasiga foydalanuvchini saqlash uchun so'rov yuboramiz
    const dbResp = await fetch(`${backendUrl}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: cleanPhone,
        name: name ? String(name).trim() : "",
        password: password || "123456"
      }),
    });

    const dbData = await dbResp.json().catch(() => ({}));

    if (!dbResp.ok && !dbData.success && !dbData.error?.includes("allaqachon")) {
      return res.status(400).json({ error: dbData.error || "Bazaga saqlashda xatolik yuz berdi." });
    }

    // 2. Telegramga adminga xabar yuborish
    const token = (process.env.BOT_TOKEN || "").trim();
    const adminId = (process.env.ADMIN_CHAT_ID || "").trim();

    if (token && adminId) {
      const text =
        `🆕 Yangi ro'yxatdan o'tish (veb-sayt)!\n` +
        `Ism: ${name && String(name).trim() ? String(name).trim() : "-"}\n` +
        `Telefon: +${cleanPhone}`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: adminId, text }),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, success: true, phone: cleanPhone });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
