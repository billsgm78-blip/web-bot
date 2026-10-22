// Sayt dizayni: hamma foydalanuvchi uchun bitta tanlov.
// GET  /api/design            → { design }            (hamma uchun)
// POST /api/design {design}   → admin tokeni bilan saqlaydi (X-Admin-Token)
// Tanlov Vercel Blob'da saqlanadi (BLOB_READ_WRITE_TOKEN — Vercel o'zi qo'shadi).

const RAILWAY_URL = (process.env.RAILWAY_URL || "https://ai2-production-7d7e.up.railway.app").replace(/\/$/, "");
const DESIGNS = ["cosmic", "modern", "classic"];
const DEFAULT = "cosmic";
const FILE = "design.json";

function blobAuth() {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) return null;
  const storeId = (process.env.BLOB_STORE_ID || token.split("_")[3] || "").trim();
  return storeId ? { token, storeId } : null;
}

async function readDesign() {
  const auth = blobAuth();
  if (!auth) return { design: DEFAULT, stored: false };
  try {
    const r = await fetch(`https://${auth.storeId}.public.blob.vercel-storage.com/${FILE}?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return { design: DEFAULT, stored: true };
    const j = await r.json();
    return { design: DESIGNS.includes(j.design) ? j.design : DEFAULT, stored: true, at: j.at || null };
  } catch (e) {
    return { design: DEFAULT, stored: true };
  }
}

async function writeDesign(design) {
  const auth = blobAuth();
  if (!auth) throw new Error("not_configured");
  const r = await fetch(`https://vercel.com/api/blob/?pathname=${encodeURIComponent(FILE)}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${auth.token}`,
      "x-api-version": "13",
      "x-vercel-blob-store-id": auth.storeId,
      "x-vercel-blob-access": "public",
      "x-content-type": "application/json",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
      "x-cache-control-max-age": "60"
    },
    body: JSON.stringify({ design, at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error("blob_" + r.status);
}

async function isAdmin(token) {
  if (!token || token.length > 512) return false;
  try {
    const r = await fetch(`${RAILWAY_URL}/api/admin/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify({ ver: 1 })
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => ({}));
    return j.success === true;
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const d = await readDesign();
    res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
    return res.status(200).json({ success: true, ...d, list: DESIGNS });
  }
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const design = String((body && body.design) || "");
  if (!DESIGNS.includes(design)) return res.status(400).json({ success: false, error: "Noto'g'ri dizayn" });

  const token = String(req.headers["x-admin-token"] || "");
  if (!(await isAdmin(token))) return res.status(401).json({ success: false, auth: false, error: "Sessiya tugagan. Qaytadan kiring." });

  try {
    await writeDesign(design);
  } catch (e) {
    const msg = e.message === "not_configured" ? "Saqlash joyi hali ulanmagan (Vercel Blob)." : "Saqlab bo'lmadi, qayta urinib ko'ring.";
    return res.status(500).json({ success: false, error: msg });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ success: true, design });
}
