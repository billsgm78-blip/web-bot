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

  let hasImage = false;

  const messages = [
    {
      role: "system",
      content: "Sen Bilols AI yordamchisisan. Foydalanuvchiga doim chiroyli, tabiiy o'zbek tilida javob ber. Hech qanday xavfsizlik hisobotlarini yozma."
    }
  ];

  history.forEach(h => {
    let role = h.role === "model" ? "assistant" : h.role;
    let content = h.content;

    if (h.parts) {
      content = h.parts.map(p => {
        if (p.text) {
          return { type: "text", text: p.text };
        } else if (p.inline_data) {
          hasImage = true;
          return {
            type: "image_url",
            image_url: {
              url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}`
            }
          };
        }
        return null;
      }).filter(Boolean);
    }

    messages.push({ role, content });
  });

  // Rasm bo'lsa vision modellariga, matn bo'lsa to'liq avtomatik rejimga
  const selectedModel = hasImage ? "openrouter/free" : "openrouter/auto";

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
        model: selectedModel,
        messages: messages
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.error?.message || "Model xatoligi yuz berdi" });
    }

    let text = data?.choices?.[0]?.message?.content || "Javob topilmadi.";

    // Xavfsizlik hisoboti chiqib qolsa tozalash
    if (text.includes("User Safety:") || text.includes("Response Safety:")) {
      text = "Salom! Sizga qanday yordam bera olaman?";
    }

    return res.status(200).json({ text: text.trim() });
  } catch (err) {
    return res.status(500).json({ error: "Server bilan bog'lanishda xatolik." });
  }
}
