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

  const { name, phone, password, code, action } = req.body || {};

  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ error: "Telefon raqami kiritilmadi yoki noto'g'ri format." });
  }

  const cleanPhone = String(phone).replace(/[^0-9]/g, "");
  
  // RAILWAY BACKEND MANZILI TO'G'RILANDI
  const backendUrl = "https://ai2-production-7d7e.up.railway.app"; 

  try {
    // 1-BOSQICH: SMS kod yuborish so'rovi
    if (action === "send_code" || (!code && action !== "verify")) {
      const verificationCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4 xonali tasdiqlash kodi

      const email = process.env.ESKIZ_EMAIL;
      const pass = process.env.ESKIZ_PASSWORD;

      if (email && pass) {
        // Eskiz tokenini olish
        const authRes = await fetch("https://notify.eskiz.uz/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass })
        });
        const authData = await authRes.json().catch(() => ({}));
        const token = authData.data?.token;

        if (token) {
          // SMS yuborish
          await fetch("https://notify.eskiz.uz/api/message/sms/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              mobile_phone: cleanPhone,
              message: `Bilols AI tasdiqlash kodi: ${verificationCode}`,
              from: "4546"
            })
          }).catch(() => {});
        }
      }

      return res.status(200).json({ 
        success: true, 
        requireOtp: true, 
        message: "SMS kod yuborildi!",
        debugCode: verificationCode 
      });
    }

    // 2-BOSQICH: Kodni tasdiqlash va bazaga saqlash
    if (action === "verify" || code) {
      // Railway'dagi backend bazasiga foydalanuvchini saqlash uchun so'rov yuboramiz
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

      // Telegramga adminga xabar yuborish
      const token = (process.env.BOT_TOKEN || "").trim();
      const adminId = (process.env.ADMIN_CHAT_ID || "").trim();

      if (token && adminId) {
        const text =
          `🆕 Yangi ro'yxatdan o'tish (SMS tasdiqlandi)!\n` +
          `Ism: ${name && String(name).trim() ? String(name).trim() : "-"}\n` +
          `Telefon: +${cleanPhone}`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: adminId, text }),
        }).catch(() => {});
      }

      return res.status(200).json({ ok: true, success: true, phone: cleanPhone });
    }

    return res.status(400).json({ error: "Noto'g'ri so'rov formati." });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
