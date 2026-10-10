/* ============================================================
   Budgeto v3 — Service Worker
   App-shell cache: offline-first penuh (data di IndexedDB).
   Strategi:
   - Halaman & aset build: cache-first (stale-while-revalidate)
   - Navigasi: fallback ke "/" saat offline
   ============================================================ */
const CACHE = "budgeto-v3";
const CORE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // biarkan Supabase dsb. langsung ke jaringan

  // Navigasi halaman: network-first, fallback cache "/"
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error()))
    );
    return;
  }

  // Aset: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetching = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || fetching;
    })
  );
});

// Pesan dari app: pemicu sinkronisasi ringan (mis. pembaruan widget)
self.addEventListener("message", (event) => {
  if (event.data === "budgeto-ping") {
    self.clients.matchAll().then((clients) => clients.forEach((c) => c.postMessage("budgeto-pong")));
  }
});
