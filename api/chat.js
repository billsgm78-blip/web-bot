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
      content: "Sen Bilols AI yordamchisisan. Doimo ravon, tabiiy va chiroyli o'zbek adabiy tilida javob ber. Hech qachon xavfsizlik hisobotlari yoki 'User Safety' kabi so'zlarni yozma. Foydalanuvchining savoliga qisqa va aniq javob qaytar."
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

  // Rasm bo'lsa vision model, matn bo'lsa o'zbek tilini a'lo darajada biladigan Llama 3.3
  const candidateModels = hasImage 
    ? ["qwen/qwen3.8-27b:free", "openrouter/free"]
    : ["meta-llama/llama-3.3-70b-instruct:free", "openrouter/free"];

  for (const model of candidateModels) {
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
          model: model,
          messages: messages
        })
      });

      const data = await resp.json();
      let text = data?.choices?.[0]?.message?.content;

      // Agar xavfsizlik tekshiruvchisi keraksiz so'zlarni qaytarsa, uni e'tiborsiz qoldiramiz
      if (text && !text.includes("User Safety:") && !text.includes("Response Safety:")) {
        return res.status(200).json({ text: text.trim() });
      }
    } catch (err) {
      // Keyingi modelga o'tish
    }
  }

  return res.status(200).json({ text: "Salom! Sizga qanday yordam bera olaman?" });
}
