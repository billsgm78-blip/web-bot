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

  const url = "https://openrouter.ai/api/v1/chat/completions";

  // Xabarlarni OpenRouter (OpenAI) formatiga moslash (rasm va matnni qo'llab-quvvatlaydi)
  const messages = history.map(h => {
    let role = h.role === "model" ? "assistant" : h.role;
    let content = h.content;

    if (h.parts) {
      content = h.parts.map(p => {
        if (p.text) {
          return { type: "text", text: p.text };
        } else if (p.inline_data) {
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

    return { role, content };
  });

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bilolsai.uz",
        "X-Title": "Bilols AI"
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5", // Rasm va matnni birdek o'qiydigan model
        messages: messages
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.error?.message || "OpenRouter API xatosi" });
    }

    const text = data?.choices?.[0]?.message?.content || "Javob topilmadi.";
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Server tarmoq xatosi." });
  }
}
