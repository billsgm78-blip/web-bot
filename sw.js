// Bilols AI — oddiy service worker: sahifa internet bo'lmasa ham ochiladi.
// API so'rovlari va boshqa saytlarga tegilmaydi.
const CACHE = "bilols-ai-v41";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/design.js?v=9", "/design.css?v=10"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // Avval internetdan (doim eng yangi versiya), bo'lmasa saqlangan nusxa.
  // Har bir sahifa o'z manzili bilan saqlanadi: /portfolio yoki /apk bosh sahifa o'rniga yozilmaydi.
  const nav = req.mode === "navigate";
  const isHome = url.pathname === "/" || url.pathname === "/index.html";
  const key = nav ? (isHome ? "/index.html" : url.pathname) : req;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && !res.redirected && (nav || SHELL.includes(url.pathname))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(key, { ignoreSearch: nav })
          .then((r) => r || (nav ? caches.match("/index.html") : null))
          .then((r) => r || Response.error())
      )
  );
});
