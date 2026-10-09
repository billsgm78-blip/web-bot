// api/change-password.js - Vercel Serverless Function

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
    return res.status(405).json({ success: false, error: "Faqat POST so'rov qabul qilinadi." });
  }

  const { phone, oldPassword, newPassword } = req.body || {};

  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ success: false, error: "Telefon raqami kiritilmadi." });
  }

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, error: "Eski va yangi parolni to'liq kiriting." });
  }

  if (String(newPassword).length < 4) {
    return res.status(400).json({ success: false, error: "Yangi parol kamida 4 ta belgi bo'lishi kerak." });
  }

  const cleanPhone = String(phone).replace(/[^0-9]/g, "");
  
  // Railway backend manzili
  const backendUrl = "https://ai2-production-7d7e.up.railway.app";

  try {
    // 1. Railway'dagi backend serverga parolni yangilash uchun so'rov yuboramiz
    const dbResp = await fetch(`${backendUrl}/api/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: cleanPhone,
        oldPassword: String(oldPassword).trim(),
        newPassword: String(newPassword).trim()
      }),
    });

    const dbData = await dbResp.json().catch(() => ({}));

    if (!dbResp.ok || !dbData.success) {
      return res.status(400).json({
        success: false,
        error: dbData.error || "Eski parol noto'g'ri yoki bazada xatolik yuz berdi."
      });
    }

    // 2. Telegram orqali adminga xavfsizlik haqida xabar yuborish
    const token = (process.env.BOT_TOKEN || "").trim();
    const adminId = (process.env.ADMIN_CHAT_ID || "").trim();

    if (token && adminId) {
      const text =
        `🔐 Parol yangilandi!\n` +
        `Telefon: +${cleanPhone}\n` +
        `Holat: Muvaffaqiyatli almashtirildi`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: adminId, text }),
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, message: "Parol muvaffaqiyatli yangilandi!" });
  } catch (e) {
    return res.status(500).json({ success: false, error: String(e) });
  }
}
