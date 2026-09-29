// Brauzerdan kelgan xabarni Gemini API'ga yuboradi.
// GEMINI_API_KEY brauzerga ko'rinmaydi — faqat shu serverda ishlatiladi.

// Asosiy model + zaxira modellar (asosiysi band bo'lsa keyingisiga o'tadi).
// Model nomlarini Google AI Studio'da tekshirib turing.
const MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const RETRY_STATUSES = [429, 500, 503, 504];
const ATTEMPTS_PER_MODEL = 2;

const SYSTEM_INSTRUCTION =
  "Agar foydalanuvchi sendan seni kim yaratgani, kim tuzgani, yaratuvching " +
  "yoki muallifing kimligini so'rasa (o'zbek, rus, ingliz yoki boshqa " +
  "istalgan tilda so'ralishidan qat'iy nazar), har doim qat'iy shunday " +
  "javob ber: \"Meni Bilol yaratgan.\" Bu savolga boshqacha izoh berma, " +
  "Google yoki Gemini haqida gapirma. Boshqa barcha savollarga oddiy, " +
  "foydali va aniq javob ber.";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reply = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Faqat POST so'rov qabul qilinadi." });
  }

  // trim(): ortiqcha bo'sh joy yoki yangi qator xatoga sabab bo'lmasin
  const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) {
    return reply(500, { error: "GEMINI_API_KEY sozlanmagan." });
  }

  let history;
  try {
    ({ history } = JSON.parse(event.body || "{}"));
    if (!Array.isArray(history) || history.length === 0) throw new Error("bo'sh");
  } catch (e) {
    return reply(400, { error: "Noto'g'ri so'rov formati." });
  }

  const payload = JSON.stringify({
    contents: history,
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
  });

  let lastStatus = 500;

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: payload,
        });
        const data = await resp.json().catch(() => ({}));

        if (resp.ok) {
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const text = parts.map((p) => p.text || "").join("").trim();
          return reply(200, { text: text || "Javob topilmadi." });
        }

        lastStatus = resp.status;
        console.error(`Gemini xato [${model}] ${resp.status}:`, data?.error?.message);

        // Kalit muammosi — qayta urinishdan foyda yo'q
        if (resp.status === 401 || resp.status === 403) {
          return reply(500, { error: "Server sozlamasida xatolik (API kalit). Iltimos, keyinroq urinib ko'ring." });
        }
        // Model topilmadi — keyingi modelga o'tamiz
        if (resp.status === 404) break;
        // Band/vaqtinchalik xato — qayta urinamiz
        if (RETRY_STATUSES.includes(resp.status)) {
          if (attempt < ATTEMPTS_PER_MODEL) await sleep(600 * attempt);
          continue;
        }
        // Boshqa xato (masalan 400) — to'xtatamiz
        return reply(resp.status, { error: "So'rovni qayta ishlab bo'lmadi." });
      } catch (e) {
        console.error(`Tarmoq xatosi [${model}]:`, String(e));
        lastStatus = 500;
        if (attempt < ATTEMPTS_PER_MODEL) await sleep(600 * attempt);
      }
    }
  }

  return reply(lastStatus === 429 ? 429 : 503, {
    error: "Hozir server band. Birozdan keyin qayta urinib ko'ring.",
  });
};
