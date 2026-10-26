// Bilols AI — oddiy service worker: sahifa internet bo'lmasa ham ochiladi.
// API so'rovlari va boshqa saytlarga tegilmaydi.
const CACHE = "bilols-ai-v32";
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
  // Avval internetdan (doim eng yangi versiya), bo'lmasa saqlangan nusxa
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === "navigate" || SHELL.includes(url.pathname))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? "/index.html" : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === "navigate" ? "/index.html" : req).then((r) => r || caches.match("/index.html")))
  );
});
