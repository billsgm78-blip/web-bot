// Bilols AI API proksi: coconut.bilolsai.uz -> bilolsai-api.onrender.com
// Faqat kirish uchun kerakli yo'llar ochiq. Brauzer bilolsai API'siga to'g'ridan-to'g'ri
// murojaat qila olmaydi (CORS), shuning uchun so'rov shu server orqali o'tadi.
const API = 'https://bilolsai-api.onrender.com';
const ALLOWED = new Set(['qr/new', 'qr/poll', 'auth-check', 'session/logout']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('{"success":false}'); }
  const path = String((req.query && req.query.p) || '');
  if (!ALLOWED.has(path)) { res.statusCode = 404; return res.end('{"success":false}'); }
  let body = req.body;
  if (typeof body !== 'string') body = JSON.stringify(body || {});
  if (body.length > 4000) { res.statusCode = 413; return res.end('{"success":false}'); }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  try {
    const r = await fetch(API + '/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': String(req.headers['user-agent'] || '').slice(0, 300), ...(ip ? { 'X-Forwarded-For': ip } : {}) },
      body,
      signal: AbortSignal.timeout(28000),
    });
    res.statusCode = r.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(await r.text());
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, error: "Bilols AI serveri bilan bog'lanib bo'lmadi. Qaytadan urining." }));
  }
};
