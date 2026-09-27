// Veb-saytdan kelgan ro'yxatdan o'tishni Telegram bot orqali adminga yuboradi.
// Xuddi bot.py dagi ro'yxatdan o'tish bildirishnomasi kabi ishlaydi.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Faqat POST so'rov qabul qilinadi." }) };
  }

  const token = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_CHAT_ID;
  if (!token || !adminId) {
    return { statusCode: 500, body: JSON.stringify({ error: "BOT_TOKEN yoki ADMIN_CHAT_ID sozlanmagan." }) };
  }

  let name, phone;
  try {
    ({ name, phone } = JSON.parse(event.body || "{}"));
    if (!phone || !phone.trim()) throw new Error("telefon raqam yo'q");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Noto'g'ri so'rov formati." }) };
  }

  const text =
    `🆕 Yangi ro'yxatdan o'tish (veb-sayt)!\n` +
    `Ism: ${name && name.trim() ? name.trim() : "-"}\n` +
    `Telefon: ${phone.trim()}`;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: adminId, text }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      return { statusCode: resp.status, body: JSON.stringify({ error: errData.description || "Telegram xatoligi" }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
