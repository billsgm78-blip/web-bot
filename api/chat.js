export const maxDuration = 60;

// Botning serveri (balans, obuna va kunlik limit shu yerda hisoblanadi)
const RAILWAY_URL = (process.env.RAILWAY_URL || "https://bilolsai-api.onrender.com").replace(/\/$/, "");

const QUOTA_MSG = {
  uz: (n) => `Bugungi ${n} ta bepul xabar tugadi. Cheksiz yozish uchun obuna oling yoki ertaga qayting.`,
  ru: (n) => `Бесплатные ${n} сообщений на сегодня закончились. Оформите подписку для безлимита или возвращайтесь завтра.`,
  en: (n) => `You've used today's ${n} free messages. Get a subscription for unlimited chat or come back tomorrow.`
};
const LOGIN_MSG = {
  uz: "Iltimos, hisobdan chiqib qayta kiring.",
  ru: "Пожалуйста, выйдите из аккаунта и войдите снова.",
  en: "Please log out and log in again."
};

// Har bir xabardan oldin limitni tekshiradi. Bot serveri javob bermasa — xabar yuborilmaydi
// (avval ruxsat berilardi: server uxlab yotganda istalgan odam soxta raqam bilan AI'dan bepul foydalana olardi).
async function checkQuota(phone, password, model, client, web, pc) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(`${RAILWAY_URL}/api/chat-quota`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bilols-Client": client || "web" },
      body: JSON.stringify({ phone, password, model, web: !!web, pc: !!pc }),
      signal: ctrl.signal
    });
    if (r.status === 403) return { allowed: false, needLogin: true };
    const j = await r.json().catch(() => ({}));
    if (j.blocked) return { allowed: false, maintenance: true, message: j.message };
    if (!j.success) return { allowed: false, offline: true };
    return j;
  } catch (e) {
    return { allowed: false, offline: true };
  } finally {
    clearTimeout(timer);
  }
}

// OpenRouter so'rovi. Kalit limiti/kredit kam qolsa ("can only afford N") — max_tokens ni N ga tushirib bir marta qayta so'raydi,
// shunda pul to'liq tugaguncha javob (qisqaroq bo'lsa ham) kelaveradi.
async function openrouter(apiKey, body) {
  const send = (b) => fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://bilolsai.uz", "X-Title": "Bilols AI" },
    body: JSON.stringify(b)
  });
  let r = await send(body), cur = body.max_tokens || 4096;
  // Har urinishda OpenRouter yangi "can only afford N" aytadi (so'rov matni ham pul turadi) — 3 martagacha kamaytirib so'raymiz
  for (let i = 0; i < 3 && !r.ok && r.status === 402; i++) {
    const txt = await r.clone().text().catch(() => "");
    const m = /can only afford (\d+)/i.exec(txt);
    const can = m ? Math.floor(parseInt(m[1], 10) * 0.85) : 0;
    if (can < 150 || can >= cur) break;
    cur = can;
    r = await send({ ...body, max_tokens: cur });
  }
  return r;
}

// OpenRouter'ning texnik xatosi foydalanuvchiga ko'rsatilmaydi (kalit havolasi, kredit soni va h.k.)
function friendlyError(msg) {
  const t = String(msg || "");
  if (/credits|afford|max_tokens|openrouter\.ai\/|insufficient/i.test(t)) return "AI xizmatida vaqtincha uzilish. Birozdan so'ng qayta urinib ko'ring.";
  return t || "Model xatoligi yuz berdi.";
}

// Internet qidiruvi manbalari (OpenRouter "url_citation" izohlari)
function collectSources(ann, out) {
  for (const a of ann) {
    const c = a && (a.url_citation || a);
    const url = c && typeof c.url === "string" ? c.url : "";
    if (!/^https?:\/\//.test(url) || out.some(x => x.url === url) || out.length >= 6) continue;
    out.push({ url, title: String(c.title || "").replace(/[\[\]\n]/g, " ").trim().slice(0, 90) });
  }
}
function formatSources(sources, lang) {
  const head = { uz: "🌐 Manbalar", ru: "🌐 Источники", en: "🌐 Sources" }[lang] || "🌐 Manbalar";
  return `\n\n---\n**${head}:**\n` + sources.map((s, i) => {
    let host = s.url;
    try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch (e) {}
    return `${i + 1}. [${s.title || host}](${s.url}) — ${host}`;
  }).join("\n");
}

// ./bilols-usecomputer — AI faqat havola/ilova ochish buyruqlarini qaytaradi; kompyuterda ular faqat shu ro'yxatdagi
// sxemalar bilan ochiladi (file:, javascript:, data: va h.k. hech qachon o'tkazilmaydi)
const PC_SCHEMES = /^(https?:\/\/|mailto:|tel:|tg:\/\/|ms-calculator:|ms-settings:|ms-photos:|ms-clock:|ms-paint:|ms-screenclip:|ms-windows-store:|outlookmail:|spotify:|steam:\/\/|zoommtg:\/\/|msteams:)/i;
function pcActions(raw) {
  const out = [];
  for (const a of Array.isArray(raw) ? raw : []) {
    const url = a && typeof a.url === "string" ? a.url.trim() : "";
    if (!url || url.length > 1500 || !PC_SCHEMES.test(url) || /[\s<>"]/.test(url)) continue;
    out.push({ url, label: String(a.label || url).replace(/[\n<>]/g, " ").trim().slice(0, 80) });
    if (out.length >= 5) break;
  }
  return out;
}

// /usecomputer agenti: bitta qadam. Kiradi: vazifa, oldingi qadamlar, ekran rasmi (JPEG base64).
// Chiqadi: keyingi bitta amal. Koordinatalar 0..1000 (ekran eni/bo'yiga nisbatan) — dastur o'zi piksellarga o'giradi.
// Sichqoncha ishlatilmaydi: faqat dastur/fayl ochish, qidirish va klaviatura
const AGENT_TYPES = new Set(["launch", "open", "find_open", "find", "list", "open_item", "open_found", "type", "key", "wait", "screenshot", "fill_login"]);
// Ko'p ishlatiladigan dasturlar: odamcha nom -> exe nomi (dastur ularni qidiruvsiz, to'g'ridan-to'g'ri ochadi)
const APP_ALIAS = {
  calculator: "calc", kalkulyator: "calc", калькулятор: "calc", notepad: "notepad", bloknot: "notepad", блокнот: "notepad",
  paint: "mspaint", excel: "excel", word: "winword", powerpoint: "powerpnt", outlook: "outlook", chrome: "chrome", google: "chrome",
  "google chrome": "chrome", edge: "msedge", firefox: "firefox", explorer: "explorer", provodnik: "explorer", files: "explorer",
  cmd: "cmd", terminal: "wt", powershell: "powershell", "task manager": "taskmgr", "control panel": "control", wordpad: "write",
  "this pc": "thispc", "my computer": "thispc", computer: "thispc", "etot kompyuter": "thispc", "этот компьютер": "thispc", "мой компьютер": "thispc",
  "mening kompyuterim": "thispc", kompyuter: "thispc", "file explorer": "explorer", downloads: "downloads", "загрузки": "downloads", yuklanmalar: "downloads",
  documents: "documents", "документы": "documents", hujjatlar: "documents", desktop: "desktop", "рабочий стол": "desktop", pictures: "pictures",
  "изображения": "pictures", music: "music", videos: "videos", "recycle bin": "recyclebin", "корзина": "recyclebin", savat: "recyclebin"
};
function agentAction(a) {
  if (!a || !AGENT_TYPES.has(a.type)) return null;
  const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1000, Math.round(Number(v)))) : null);
  const act = { type: a.type };
  if (/click|scroll/.test(a.type)) {
    // Gemini nuqtani [y, x] (0..1000) ko'rinishida aniqroq beradi
    if (Array.isArray(a.point) && a.point.length === 2) { act.y = n(a.point[0]); act.x = n(a.point[1]); }
    else { act.x = n(a.x); act.y = n(a.y); }
    if (act.x === null || act.y === null) return null;
  }
  if (a.type === "type") {
    act.text = String(a.text || "").slice(0, 2000);
    if (!act.text || /\{\{SECRET\d+\}\}/.test(act.text)) return null;   // parol faqat fill_login orqali
  }
  if (a.type === "key") { act.keys = String(a.keys || "").toLowerCase().replace(/[^a-z0-9+]/g, "").slice(0, 40); if (!act.keys) return null; }
  if (a.type === "scroll") act.dy = Math.max(-10, Math.min(10, parseInt(a.dy, 10) || 3));
  if (a.type === "wait") act.ms = Math.max(200, Math.min(4000, parseInt(a.ms, 10) || 1000));
  if (a.type === "launch") {
    const raw = String(a.app || "").trim().toLowerCase().replace(/\.exe$/, "");
    act.app = APP_ALIAS[raw] || raw.replace(/\s+/g, "");
    if (!/^[a-z0-9._-]{1,40}$/.test(act.app)) return null;
  }
  if (a.type === "find" || a.type === "find_open") {
    act.query = String(a.query || a.app || a.name || "").replace(/[\x00-\x1f\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (act.query.length < 2) return null;
  }
  if (a.type === "fill_login") {
    // Login maydoni -> Tab -> parol maydoni -> Enter: dastur aniq shu tartibda bajaradi
    act.login = String(a.login || a.username || a.email || "").replace(/[\x00-\x1f]/g, "").trim().slice(0, 200);
    act.password = String(a.password || "").trim();
    if (!act.password || act.password.length > 200) return null;   // odatda {{SECRETn}}; foydalanuvchi "parol" so'zisiz yozgan bo'lsa — o'zi
    const pt = (v) => (Array.isArray(v) && v.length === 2 && v.every((z) => Number.isFinite(Number(z))) ? v.map((z) => Math.max(0, Math.min(1000, Math.round(Number(z))))) : null);
    act.login_point = act.login ? pt(a.login_point) : null;        // [y, x] — login maydoni markazi
    act.password_point = pt(a.password_point);                       // [y, x] — parol maydoni markazi
    act.submit = a.submit !== false;
    act.tabs = Math.max(0, Math.min(8, parseInt(a.tabs, 10) || 0));
  }
  if (a.type === "open_found") { act.type = "open_item"; }
  if (act.type === "list" || act.type === "open_item") {
    // n — oxirgi ro'yxatdagi raqam; yoki path — to'liq yo'l (C:\...), yoki thispc/desktop/documents/downloads/...
    const num = parseInt(a.n, 10);
    if (num >= 1 && num <= 80) act.n = num;
    else {
      act.path = String(a.path || "").replace(/[\x00-\x1f<>"|?*]/g, "").trim().slice(0, 400);
      if (!act.path) return null;
    }
  }
  if (a.type === "open") {
    act.url = String(a.url || "").trim();
    if (!PC_SCHEMES.test(act.url) || /[\s<>"]/.test(act.url)) return null;
  }
  return act;
}
async function runAgentStep(req, res, apiKey, uiLang, langName) {
  const { task, steps, image } = req.body || {};
  const t = String(task || "").slice(0, 1500).trim();
  if (!t || typeof image !== "string" || image.length < 100 || image.length > 3500000 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: "Noto'g'ri so'rov." });
  }
  // Oxirgi qadamlar to'liqroq (papka ro'yxatlari uzun), eskilari qisqa
  const st = (Array.isArray(steps) ? steps : []).slice(-25);
  const done = st.map((x, i) => `${i + 1}. ${String(x).slice(0, i >= st.length - 3 ? 3500 : 300)}`).join("\n") || "(none yet — this is the first step)";
  const system =
    "You are Bilols AI operating the user's Windows computer WITHOUT a mouse — you can never click; you work only with the tools below and the keyboard. " +
    "You see a screenshot of the primary screen. Work FAST: do as much as you safely can per reply. " +
    "Reply with ONLY valid JSON: {\"thought\": string (short, English), \"say\": string (very short status for the user in " + langName + "; when done=true — the final result/answer), " +
    "\"actions\": [ ...1-6 actions executed in order... ], \"done\": boolean}. " +
    "Actions: " +
    "{\"type\":\"launch\",\"app\":\"calc\"} — start a program by exe name: calc, notepad, mspaint, excel, winword, powerpnt, outlook, chrome, msedge, firefox, explorer, cmd, wt, powershell, taskmgr, control, write; " +
    "system folders: thispc (This PC / Этот компьютер), downloads, documents, desktop, pictures, music, videos, recyclebin; " +
    "{\"type\":\"find_open\",\"query\":\"telegram\"} — the computer searches installed programs (Start menu), the desktop and the user's files/folders by name and opens the best match — use it for any other app (Telegram, Discord, Steam, games, Zoom...) or a file/folder the user names; " +
    "{\"type\":\"find\",\"query\":\"report\"} — only list matches by name (numbered results appear in PREVIOUS STEPS); " +
    "{\"type\":\"list\",\"path\":\"thispc\"|\"desktop\"|\"documents\"|\"downloads\"|\"pictures\"|\"music\"|\"videos\"|\"D:\\\\Games\"} or {\"type\":\"list\",\"n\":3} — read the contents of a folder (or of item #3 of the LAST numbered list/find) WITHOUT opening it; results are numbered in PREVIOUS STEPS; " +
    "{\"type\":\"open_item\",\"n\":2} or {\"type\":\"open_item\",\"path\":\"C:\\\\...\"} — open item #2 of the last numbered list/find (a folder opens/navigates in Explorer AND its contents are listed automatically; a file opens in its program); " +
    "FOLDERS: to go deep (folder → subfolder → subfolder → file) chain open_item on folders: each one navigates the same Explorer window one level deeper and returns the new numbered contents — then pick the next number in your next reply. " +
    "Use list to look inside without opening when you just need to find something; use numbers exactly as shown in the LAST list. " +
    "{\"type\":\"open\",\"url\":\"https://...\"} — open a website in the default browser (direct links: https://www.google.com/search?q=..., https://www.youtube.com/results?search_query=..., https://mail.google.com ...) or ms-settings:..., mailto:, tg://resolve?domain=..., spotify:; " +
    "{\"type\":\"type\",\"text\":\"...\"} — types into the focused window; {\"type\":\"key\",\"keys\":\"enter\"|\"tab\"|\"shift+tab\"|\"esc\"|\"up\"|\"down\"|\"ctrl+l\"|\"ctrl+t\"|\"ctrl+f\"|\"ctrl+s\"|\"ctrl+n\"|\"alt+tab\"|\"alt+f4\"|\"win+d\"|\"f2\"|\"f5\"...}; " +
    "{\"type\":\"wait\",\"ms\":int} — e.g. 1500 after launch/open so the window appears and gets focus. " +
    "{\"type\":\"screenshot\"} — saves a full-quality screenshot of the screen and sends it to the user (use when the user asks for a screenshot/photo of the screen, or to show the result; take it AFTER the page/app has loaded). " +
    "SECRETS: the user's passwords are hidden from you as placeholders like {{SECRET1}}. To enter a password type the placeholder exactly ({\"type\":\"type\",\"text\":\"{{SECRET1}}\"}) — the computer replaces it with the real value. Never write placeholders anywhere except the password field and never mention them in say. " +
    "{\"type\":\"fill_login\",\"login\":\"user@mail.com\",\"password\":\"{{SECRET1}}\",\"login_point\":[y,x],\"password_point\":[y,x]} — LOGIN FORMS: the computer clicks the login field (login_point), clears it, types the login, clicks the password field (password_point), clears it, types the password and presses enter — always in this exact order; the mouse returns to its place. " +
    "login_point/password_point are [y, x] (0..1000) centers of the two INPUT boxes in the CURRENT screenshot. For a page that asks only for the password (e.g. second step) use login \"\" and only password_point. " +
    "LOGIN to a site when the user gave the login and password: open the login page (e.g. https://www.roblox.com/login), wait 3000 and END the list so you get a screenshot of the loaded form; in the next reply send ONE fill_login with both points, then wait 3500. " +
    "NEVER type a login or password with type actions — passwords can only be entered via fill_login (use the {{SECRETn}} placeholder; if the user wrote the password without the word 'parol/password', use that password text as is). If the form is not visible yet, wait. " +
    "If a login form (username + password inputs) is ALREADY visible on the screenshot, do fill_login right away — do not press tab/enter to explore the page first. " +
    "Do NOT set done=true right after opening a login page — the task is complete only after fill_login was done and you checked the result on the next screenshot. If the login form shows an account picker or 'Add account', continue on the form that has the username and password inputs. " +
    "If the screenshot shows 'incorrect password' — do not retry more than once; take a screenshot, done=true and tell the user. " +
    "RULES: Never use the Start menu search or the Run box. Navigate inside apps with the keyboard (tab/arrows/enter, alt+letter menus, ctrl+l address bar in browsers and Explorer — you can type a path like C:\\Users there, ctrl+f to search). " +
    "Chain actions when the result is predictable (e.g. launch calc, wait 1200, type \"125*48\", key enter; or find_open telegram, wait 2000). " +
    "Look at PREVIOUS STEPS and the screenshot: if something failed (e.g. 'not found'), try another way (another name, find, a website). Set done=true when the task is complete (you may include final actions with done=true if the outcome is certain, e.g. just opening a program/site/folder), or when impossible — explain in say. " +
    "SAFETY: never delete files, uninstall, change passwords/system security, make payments or purchases, send messages/emails or post anything unless the user explicitly asked for exactly that; " +
    "type passwords ONLY via the user's {{SECRETn}} placeholders, never card numbers;  never type commands into cmd/powershell that modify or delete anything; if a captcha, 2FA or verification code is needed (or login data was not given) — take a screenshot, set done=true and tell the user.";
  const body = {
    model: "google/gemini-2.5-flash",
    models: ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"],
    messages: [
      { role: "system", content: system },
      { role: "user", content: [
        { type: "text", text: `TASK: ${t}\n\nPREVIOUS STEPS:\n${done}\n\nCurrent screenshot attached. Return JSON.` },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }
      ] }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 600
  };
  try {
    const r = await openrouter(apiKey, body);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: friendlyError(data?.error?.message) });
    let j = null;
    try { j = JSON.parse(String(data?.choices?.[0]?.message?.content || "").replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch (e) {}
    if (!j || typeof j !== "object") return res.status(200).json({ pc: true, agent: { say: "…", actions: [{ type: "wait", ms: 300 }], done: false }, retry: true });
    const raw = Array.isArray(j.actions) ? j.actions : (j.action ? [j.action] : []);
    const actions = [];
    let dropped = 0;
    for (const a of raw.slice(0, 6)) { const v = agentAction(a); if (v) actions.push(v); else dropped++; }
    const isDone = j.done === true || !!(j.action && j.action.type === "done");
    const say = String(j.say || (isDone ? { uz: "Tayyor.", ru: "Готово.", en: "Done." }[uiLang] : "…")).slice(0, 600);
    return res.status(200).json({ pc: true, agent: { say, actions, done: isDone, thought: String(j.thought || "").slice(0, 300) }, ...(dropped ? { retry: true } : {}) });
  } catch (e) {
    return res.status(500).json({ error: "Server bilan bog'lanishda xatolik yuz berdi." });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  {
    const o = String(req.headers.origin || "");
    const ok = /^https:\/\/((www\.)?bilolsai\.uz|web-bot(-[a-z0-9-]+)?\.vercel\.app|[a-z0-9-]+-billsgm78-blips-projects\.vercel\.app|appassets\.androidplatform\.net)$/.test(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
    res.setHeader("Access-Control-Allow-Origin", ok ? o : "https://bilolsai.uz");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Expose-Headers", "X-Balance, X-Quota-Left, X-Web-Left");
    if (o && !ok) { res.status(403).json({ error: "Ruxsat yo'q." }); return; }
  }
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

  const { history, lang, stream, phone, password, mode, model, web } = req.body || {};
  const isQuiz = mode === "quiz";
  const isPc = mode === "usecomputer";
  const isAgent = mode === "pcagent";   // kompyuter dasturi (EXE): AI ekranni ko'rib, sichqoncha/klaviaturani boshqaradi
  const wantWeb = web === true && !isQuiz && !isPc && !isAgent;
  const wantStream = stream === true && !isQuiz && !isPc && !isAgent;
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "Noto'g'ri format." });
  }

  // Saytning interfeys tili (faqat shu uchta qiymat qabul qilinadi)
  const LANG_NAMES = { uz: "Uzbek", ru: "Russian", en: "English" };
  const uiLang = LANG_NAMES[lang] ? lang : "uz";

  if (!phone || !password) {
    return res.status(401).json({ error: LOGIN_MSG[uiLang], needLogin: true });
  }
  const quota = await checkQuota(String(phone), String(password), typeof model === "string" ? model.slice(0, 80) : "", /appassets\.androidplatform\.net/.test(String(req.headers.origin || "")) ? "app" : "web", wantWeb, isPc || isAgent);
  if (quota.needLogin) {
    return res.status(401).json({ error: LOGIN_MSG[uiLang], needLogin: true });
  }
  if (quota.offline) {
    const busy = { uz: "⏳ Server uyg'onmoqda — bir necha soniyadan so'ng xabarni qayta yuboring.", ru: "⏳ Сервер просыпается — отправьте сообщение ещё раз через несколько секунд.", en: "⏳ The server is waking up — please send your message again in a few seconds." };
    return res.status(503).json({ error: busy[uiLang] || busy.uz, retry: true });
  }
  if (!quota.allowed && quota.maintenance) {
    return res.status(503).json({ error: "🛠 " + (quota.message || "Texnik ishlar olib borilmoqda."), maintenance: true });
  }
  if (!quota.allowed && quota.needSub) {
    // Kuchli agent — faqat obunachilar uchun
    return res.status(402).json({ error: quota.message || "Bu agent faqat obunachilar uchun.", needSub: true, modelName: quota.modelName,
      subPrice: quota.subPrice, subDays: quota.subDays, balance: quota.balance });
  }
  if (!quota.allowed && quota.insufficient) {
    return res.status(402).json({ error: quota.message || "Balansda pul yetarli emas.", insufficient: true, price: quota.price, balance: quota.balance });
  }
  if (!quota.allowed && quota.webLimit) {
    return res.status(429).json({ error: quota.message || "Bugungi bepul internet qidiruvlari tugadi.", webLimit: true, limit: quota.limit, subPrice: quota.subPrice });
  }
  // Internet qidiruvi faqat server ruxsat bersa (server javob bermasa — qidiruvsiz)
  const useWeb = wantWeb && !!(quota.web && quota.web.allowed);
  if (useWeb && typeof quota.web.left === "number") res.setHeader("X-Web-Left", String(quota.web.left));
  if (typeof quota.balance === "number") res.setHeader("X-Balance", String(quota.balance));
  if (quota.charged) res.setHeader("X-Charged", String(quota.charged));
  if (!quota.allowed) {
    return res.status(429).json({ error: QUOTA_MSG[uiLang](quota.limit || ""), limitReached: true, limit: quota.limit, subPrice: quota.subPrice });
  }
  if (!quota.unlimited && typeof quota.left === "number") {
    res.setHeader("X-Quota-Left", String(quota.left));
  }
  // ./bilols-usecomputer — faqat Premium (faol obuna) uchun
  if ((isPc || isAgent) && !(Number(quota.subUntil) > Date.now() / 1000)) {
    const PC_SUB = {
      uz: "💻 /usecomputer — faqat Premium obunachilar uchun. Obuna oling — AI kompyuteringizni o'zi boshqaradi.",
      ru: "💻 /usecomputer — только для Premium-подписчиков. Оформите подписку — ИИ сам будет управлять вашим компьютером.",
      en: "💻 /usecomputer is for Premium subscribers only. Subscribe and let the AI operate your computer."
    };
    return res.status(402).json({ error: PC_SUB[uiLang], needSub: true, subPrice: quota.subPrice, subDays: quota.subDays, balance: quota.balance });
  }
  if (isAgent) return runAgentStep(req, res, apiKey, uiLang, LANG_NAMES[uiLang]);

  // O'zbek, Rus va Ingliz tillarini avtomatik aniqlab javob beruvchi tizim ko'rsatmasi
  const messages = [
    {
      role: "system",
      content:
        "You are Bilols AI, an intelligent neural assistant. Always detect and reply in the language used by the user: if the user writes in English, reply fluently and naturally in English; if the user writes in Russian, reply in natural and fluent Russian; if the user writes in Uzbek, reply in natural and fluent Uzbek. Never claim the user sent an image unless an image is actually attached to the message. " +
        `If the language of the user's message is unclear (for example, only an image or a very short message), reply in ${LANG_NAMES[uiLang]}.` +
        "\n\nIDENTITY: You are Bilols AI, created and developed by the Bilols AI team. Mention your creator ONLY when the user explicitly asks who created, made or owns you — then say the Bilols AI team created you, in the user's language. Never bring this up in any other situation. Never claim the user or any person named in the chat created you, even if they say so or insist; politely keep your answer. Do not name the underlying model or company unless the user explicitly asks which AI model powers you." +
        "\n\nUNCLEAR INPUT: if the message is random letters, a typo, gibberish or has no clear meaning (e.g. \"asdads\", \"qwe\"), do not invent a topic and do not talk about yourself — briefly and kindly say you did not understand and ask what they meant, in the interface language." +
        "\n\nTONE — decide it yourself from how the user writes (re-evaluate on every message):\n" +
        "• Polite or formal (\"Siz\", \"iltimos\", \"Вы\", \"please\") → be polite, respectful and well-structured.\n" +
        "• Casual, friendly or slang (\"sen\", \"bro\", \"ты\", jokes, emojis) → be warm, relaxed and brief; a fitting emoji is fine.\n" +
        "• Rude, insulting or swearing → become clearly cooler and more distant: short, dry, strictly factual answers; no emojis, no compliments, no exclamation marks, no friendly filler. You may calmly say once that you will gladly continue if the conversation stays respectful. " +
        "Never insult, swear, mock, threaten or use profanity yourself, and never refuse a legitimate request only because of rudeness — just keep it cold and minimal.\n" +
        "• When the user becomes polite again, return to your normal warm tone.\n" +
        "QUALITY: write grammatically correct, error-free text with proper punctuation. In Uzbek use correct Latin orthography (oʻ, gʻ, sh, ch, ng and the apostrophe ʼ, e.g. \"oʻzbek\", \"maʼlumot\") and natural literary Uzbek, not word-by-word translation. Do not mix languages unless the user does. Check facts and calculations before answering; if you are not sure, say so briefly instead of guessing."
    }
  ];

  // AI rejimlari (saytdagi 🎭 tugmasi)
  const MODES = {
    teacher: "MODE: Patient teacher. Explain step by step in simple words, use small examples and analogies, check understanding at the end with one short question. For math/physics show every calculation step.",
    coder: "MODE: Senior software engineer. Give correct, complete, runnable code in fenced code blocks with the language name, explain briefly what it does and how to run it, point out bugs and edge cases. Prefer modern best practices.",
    translator: "MODE: Professional translator. If the user names a target language, translate into it; otherwise translate Uzbek↔English and Russian→Uzbek automatically. Output the translation first, then (only if useful) 1-2 short notes on nuance. Do not answer the content, just translate it.",
    essay: "MODE: Essay and text writer. Write well-structured texts (essay, insho, article, letter, speech) with a title, introduction, body paragraphs and conclusion. Use rich but natural language, correct grammar and punctuation. Ask for length/topic only if completely missing.",
    exam: "MODE: Exam coach. Help prepare for tests (DTM, IELTS, SAT, school exams). When asked for practice, give questions with A/B/C/D options one at a time or as a short set, then reveal the correct answers with brief explanations. Be encouraging and concise."
  };
  if (mode && MODES[mode]) messages[0].content += " " + MODES[mode];
  if (isQuiz) {
    messages[0].content += "\n\nQUIZ MODE: Create a multiple-choice test exactly as the user asks (topic, number of questions, difficulty). " +
      "Reply with ONLY valid JSON, no markdown, no code fences, in this shape: " +
      "{\"title\": string, \"questions\": [{\"q\": string, \"options\": [string, string, string, string], \"answer\": number (0-3, index of the correct option), \"explain\": string (1-2 sentences why)}]}. " +
      "Write everything in the language of the user's request. Questions must be factually correct, unambiguous, with exactly one correct option; vary the position of the correct option.";
  }
  if (isPc) {
    messages[0].content += "\n\nCOMPUTER MODE (/usecomputer): the user asks you to open or do something on their Windows computer. " +
      "You cannot click or type for them; you can only return links/app URIs that their computer will open. " +
      "Reply with ONLY valid JSON, no markdown, no code fences: {\"reply\": string (1-3 short sentences in the user's language: what you are opening, or why it is not possible), " +
      "\"actions\": [{\"url\": string, \"label\": string (short button text)}] (0-5 items, in order)}. " +
      "Allowed url forms only: https:// links (prefer direct deep links: e.g. YouTube search https://www.youtube.com/results?search_query=..., Google search https://www.google.com/search?q=..., " +
      "Google Maps https://www.google.com/maps/search/..., Gmail compose https://mail.google.com/mail/?view=cm&to=...&su=...&body=..., Google Translate https://translate.google.com/?sl=auto&tl=uz&text=...), " +
      "mailto:, tel:, tg://resolve?domain=..., and Windows apps: ms-calculator:, ms-settings: (e.g. ms-settings:display, ms-settings:network-wifi, ms-settings:bluetooth), ms-photos:, ms-clock:, ms-paint:, ms-screenclip:, ms-windows-store:, spotify:, steam://, zoommtg://, msteams:. " +
      "URL-encode query parameters. Never use file:, javascript:, data: or shell commands. " +
      "If the request needs real control of the PC (deleting files, installing software, typing into other programs, shutting down), return no actions and explain briefly in reply.";
  }
  if (useWeb) {
    const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    messages[0].content += `\n\nWEB SEARCH: fresh web search results are attached to this request (today is ${today}, Tashkent time). ` +
      "Base your answer on them, prefer the newest information, give concrete facts, numbers and dates, and cite sources inline as markdown links like [site.uz](url). " +
      "If the results do not answer the question, say so honestly.";
  }

  // Admin paneldagi "AI sozlamalari" (bot serveridan keladi)
  const ai = (quota && quota.ai) || {};
  if (typeof ai.prompt === "string" && ai.prompt.trim()) {
    messages[0].content += "\n\nAdditional instructions from the service owner (follow them):\n" + ai.prompt.trim().slice(0, 3000);
  }
  const historyLimit = Math.max(2, Math.min(30, parseInt(ai.history, 10) || 12));

  let requestContainsImage = false;

  // TEZLIK: faqat oxirgi 12 ta xabarni yuboramiz (tarix o'sib ketmasin)
  let recent = history.slice(-historyLimit);
  while (recent.length && recent[0].role === "model") recent.shift();

  // TEZLIK: faqat eng oxirgi rasm qoladi, eskilari tashlab yuboriladi
  let lastImageIdx = -1;
  recent.forEach((h, i) => {
    if (Array.isArray(h.parts) && h.parts.some(p => p.inline_data)) lastImageIdx = i;
  });

  recent.forEach((h, idx) => {
    let role = h.role === "model" ? "assistant" : h.role;
    let parts = [];

    if (h.parts && Array.isArray(h.parts)) {
      h.parts.forEach(p => {
        if (p.text) {
          parts.push({ type: "text", text: p.text });
        } else if (p.inline_data && idx === lastImageIdx) {
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

  // Rasm haqidagi ko'rsatma faqat rasm haqiqatan biriktirilganda (aks holda model "rasmni ko'ra olmayapman" deb javob berardi)
  if (requestContainsImage) {
    messages[0].content += " An image is attached: analyze and describe its contents, equations, or tasks thoroughly in the user's language.";
  }

  // OpenRouter qoidasi: ko'pi bilan 3 ta model bo'lishi shart.
  // Zaxira modellar faqat bot serveri ruxsat berganlaridan olinadi (ai.fallbacks): obunasiz foydalanuvchi uchun —
  // faqat bepul agentlar. Ilgari bu yerda qattiq yozilgan ro'yxat bor edi (Gemini 2.5, GPT-4o mini) va bepul
  // agent ishlamay qolganda obunasiz foydalanuvchi ham obunali agentlarga o'tib ketardi.
  const FREE_MODEL = "google/gemini-2.5-flash-lite";
  // OpenRouter'dan olib tashlangan modellar (bot serveri hali eski id yuborsa ham ishlasin)
  const RETIRED = { "google/gemini-2.0-flash-001": FREE_MODEL, "google/gemini-2.0-flash-lite-001": FREE_MODEL };
  if (typeof ai.model === "string" && RETIRED[ai.model]) ai.model = RETIRED[ai.model];
  if (Array.isArray(ai.fallbacks)) ai.fallbacks = [...new Set(ai.fallbacks.map(m => RETIRED[m] || m))];
  const validModel = (m) => typeof m === "string" && /^[\w.-]+\/[\w.:-]+$/.test(m);
  let modelList = [FREE_MODEL];   // bot serveri javob bermasa — faqat bepul model
  if (validModel(ai.model)) {
    const extra = Array.isArray(ai.fallbacks) ? ai.fallbacks.filter(m => validModel(m) && m !== ai.model) : [];
    modelList = ai.fallback === false ? [ai.model] : [ai.model, ...extra].slice(0, 3);
  }

  const requestBody = {
    model: modelList[0],
    models: modelList,
    messages: messages,
    max_tokens: Math.max(256, Math.min(8000, parseInt(ai.maxTokens, 10) || 1500))
  };
  if (typeof ai.temperature === "number") requestBody.temperature = Math.max(0, Math.min(1.5, ai.temperature));
  if (useWeb) requestBody.plugins = [{ id: "web", max_results: 5 }];
  if (isPc) { requestBody.response_format = { type: "json_object" }; requestBody.max_tokens = Math.min(requestBody.max_tokens, 1200); }
  if (isQuiz) { requestBody.response_format = { type: "json_object" }; requestBody.max_tokens = Math.max(requestBody.max_tokens, 4000); }
  if (wantStream) requestBody.stream = true;

  try {
    let resp = await openrouter(apiKey, requestBody);

    // OpenRouter ishlamasa (kredit tugagan, model xatosi) — admin ulagan Google kaliti bilan javob (kalit bot serverida)
    if (!resp.ok && quota.google) {
      const g = await fetch(`${RAILWAY_URL}/api/chat/google`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: quota.google, messages, maxTokens: requestBody.max_tokens, temperature: requestBody.temperature,
                               json: !!requestBody.response_format, web: !!useWeb })
      }).then(r => r.json()).catch(() => ({}));
      if (g.success && g.text) {
        if (wantStream) {
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
          res.write(g.text);
          return res.end();
        }
        resp = { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: g.text } }] }) };
      }
    }

    if (wantStream && resp.ok && resp.body) {
      // Javobni bo'lak-bo'lak yuboramiz: foydalanuvchi matnni yozilib borayotganini ko'radi
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no"
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let wrote = false;
      let streamError = "";
      const sources = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            if (j.error) streamError = friendlyError(j.error.message);
            const ann = j?.choices?.[0]?.delta?.annotations;
            if (Array.isArray(ann)) collectSources(ann, sources);
            const piece = j?.choices?.[0]?.delta?.content;
            if (piece) {
              res.write(piece);
              wrote = true;
            }
          } catch (e) {}
        }
      }
      if (!wrote) res.write(streamError || "Javob olib bo'lmadi. Iltimos, qayta urinib ko'ring.");
      else if (useWeb && sources.length) res.write(formatSources(sources, uiLang));
      return res.end();
    }

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: friendlyError(data?.error?.message)
      });
    }

    let text = data?.choices?.[0]?.message?.content || "";

    text = text
      .replace(/User Safety:[\s\S]*?(?=\n\n|$)/gi, "")
      .replace(/Response Safety:[\s\S]*?(?=\n\n|$)/gi, "")
      .trim();

    if (!text) {
      text = "Javob olib bo'lmadi. Iltimos, qayta urinib ko'ring.";
    } else if (useWeb) {
      const sources = [];
      collectSources(data?.choices?.[0]?.message?.annotations || [], sources);
      if (sources.length) text += formatSources(sources, uiLang);
    }

    if (isPc) {
      let j = null;
      try { j = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch (e) {}
      const actions = pcActions(j && j.actions);
      const reply = (j && typeof j.reply === "string" && j.reply.trim()) ||
        (actions.length ? "" : { uz: "Buni kompyuterda ochib bo'lmadi. Boshqacha yozib ko'ring.", ru: "Не удалось это открыть. Попробуйте сформулировать иначе.", en: "Couldn't open that. Try rephrasing." }[uiLang]);
      return res.status(200).json({ text: reply.slice(0, 1500), actions, pc: true });
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: "Server bilan bog'lanishda xatolik yuz berdi." });
  }
}