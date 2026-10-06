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

  // Tarixda rasm bor-yo'qligini tekshiramiz
  let hasImage = false;

  const messages = history.map(h => {
    let role = h.role === "model" ? "assistant" : h.role;
    let content = h.content;

    if (h.parts) {
      content = h.parts.map(p => {
        if (p.text) {
          return { type: "text", text: p.text };
        } else if (p.inline_data) {
          hasImage = true; // Rasm topildi!
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

  // Agar rasm bo'lsa - Vision modellari, agar faqat matn bo'lsa - openrouter/auto
  const candidateModels = hasImage 
    ? [
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.2-11b-vision-instruct:free",
        "google/gemini-2.0-flash-thinking-exp:free"
      ]
    : [
        "openrouter/auto"
      ];

  let lastError = null;

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

      if (resp.ok && data?.choices?.[0]?.message?.content) {
        return res.status(200).json({ text: data.choices[0].message.content });
      } else {
        lastError = data?.error?.message || "Model javob bermadi";
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(500).json({ error: lastError || "Server bilan bog'lanishda xatolik." });
}
