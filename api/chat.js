export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "API key sozlanmagan." });
  }

  const { history } = req.body || {};
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "Noto'g'ri format." });
  }

  const messages = [
    {
      role: "system",
      content: "Sen Bilols AI yordamchisisan. Foydalanuvchi bilan har doim ravon, tabiiy o'zbek tilida gaplash. Agar rasm yuborilgan bo'lsa, undagi narsalarni, obyektlarni to'liq tahlil qilib ber."
    }
  ];

  history.forEach(h => {
    let role = h.role === "model" ? "assistant" : h.role;
    let content = [];

    if (h.parts) {
      h.parts.forEach(p => {
        if (p.text) {
          content.push({ type: "text", text: p.text });
        } else if (p.inline_data) {
          content.push({
            type: "image_url",
            image_url: {
              url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}`
            }
          });
        }
      });
    }

    if (content.length > 0) {
      messages.push({ role, content });
    }
  });

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bilolsai.uz",
        "X-Title": "Bilols AI"
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        messages: messages
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.error?.message || "Model xatoligi yuz berdi." });
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
