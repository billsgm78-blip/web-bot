// Bu funksiya brauzerdan kelgan xabarni Gemini API'ga yuboradi.
// GEMINI_API_KEY brauzerga hech qachon ko'rinmaydi — faqat shu serverda ishlatiladi.

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION =
  "Agar foydalanuvchi sendan seni kim yaratgani, kim tuzgani, yaratuvching " +
  "yoki muallifing kimligini so'rasa (o'zbek, rus, ingliz yoki boshqa " +
  "istalgan tilda so'ralishidan qat'iy nazar), har doim qat'iy shunday " +
  "javob ber: \"Meni Bilol yaratgan.\" Bu savolga boshqacha izoh berma, " +
  "Google yoki Gemini haqida gapirma. Boshqa barcha savollarga oddiy, " +
  "foydali va aniq javob ber.";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Faqat POST so'rov qabul qilinadi." }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY sozlanmagan." }) };
  }

  let history;
  try {
    ({ history } = JSON.parse(event.body || "{}"));
    if (!Array.isArray(history) || history.length === 0) {
      throw new Error("history bo'sh");
    }
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Noto'g'ri so'rov formati." }) };
  }

  try {
    const resp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: history,
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data?.error?.message || "Gemini xatoligi" }) };
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();

    return { statusCode: 200, body: JSON.stringify({ text: text || "Javob topilmadi." }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
