export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "API kaliti sozlanmagan." });
  }

  const { history } = req.body || {};
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "Noto'g'ri format." });
  }

  // O'zbek va Ingliz tillarini avtomatik aniqlab javob beruvchi tizim ko'rsatmasi
  const messages = [
    {
      role: "system",
      content:
        "You are Bilols AI, an intelligent neural assistant. Always detect and reply in the language used by the user: if the user writes in English, reply fluently and naturally in English; if the user writes in Uzbek, reply in natural and fluent Uzbek. If an image is provided, analyze and describe its contents, equations, or tasks thoroughly in the user's language."
    }
  ];

  let requestContainsImage = false;

  history.forEach(h => {
    let role = h.role === "model" ? "assistant" : h.role;
    let parts = [];

    if (h.parts && Array.isArray(h.parts)) {
      h.parts.forEach(p => {
        if (p.text) {
          parts.push({ type: "text", text: p.text });
        } else if (p.inline_data) {
          requestContainsImage = true;
          parts.push({
            type: "image_url",
            image_url: {
              url: `data:${p.inline_data.mime_type || "image/jpeg"};base64,${p.inline_data.data}`
            }
          });
        }
      });
    }

    if (parts.length > 0) {
      messages.push({ role, content: parts });
    }
  });

  const requestBody = {
    model: "openrouter/auto",
    messages: messages
  };

  // OpenRouter qoidasi: ko'pi bilan 3 ta model bo'lishi shart
  if (requestContainsImage) {
    requestBody.models = [
      "google/gemini-2.5-flash",
      "google/gemini-2.0-flash-001",
      "openai/gpt-4o-mini"
    ];
  }

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bilolsai.uz",
        "X-Title": "Bilols AI"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.error?.message || "Model xatoligi yuz berdi."
      });
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