import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY sozlanmagan." });
  }

  const { history } = req.body || {};
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "Noto'g'ri format." });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Oxirgi xabarni olib yuborish yoki chat history'ni moslashtirish
    const chat = model.startChat({
      history: history.slice(0, -1).map(h => ({
        role: h.role === "model" ? "model" : "user",
        parts: h.parts
      }))
    });

    const lastMessage = history[history.length - 1];
    const result = await chat.sendMessage(lastMessage.parts);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text: text || "Javob topilmadi." });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server xatosi." });
  }
}
