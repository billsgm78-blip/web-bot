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

  const url = "https://api.groq.com/openai/v1/chat/completions";

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: history.map(h => ({
          role: h.role === "model" ? "assistant" : h.role,
          content: h.parts ? h.parts.map(p => p.text || "").join("") : h.content
        }))
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.error?.message || "Groq API xatosi" });
    }

    const text = data?.choices?.[0]?.message?.content || "Javob topilmadi.";
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Server tarmoq xatosi." });
  }
}
