/* ============================================================
   BUDGETO v2 — Service Worker
   - Network-first: selalu cari versi terbaru saat online
   - Offline fallback: buka cache terakhir saat offline
   - Periodic background sync: pengingat harian (PWA ter-install)
   ============================================================ */

const CACHE = "budgeto-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Jangan pernah cache request ke Supabase / API eksternal
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman: network first, fallback cache, fallback "/"
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("/"))
        )
    );
    return;
  }

  // Aset statis: network first dgn cache fallback
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (url.origin === self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// ─── Pengingat harian via periodic background sync ───────────
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "budgeto-reminder") {
    event.waitUntil(fireReminder());
  }
});

async function fireReminder() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const last = await getIdbMeta("last-reminder");
    if (last === today) return;

    // Cek via IDB apakah sudah ada pengeluaran hari ini
    const hasExpenseToday = await checkTodayExpense(today);
    if (hasExpenseToday) return;

    await setIdbMeta("last-reminder", today);
    await self.registration.showNotification("Jangan lupa catat keuangan 💰", {
      body: "Ada pengeluaran hari ini yang belum dicatat di Budgeto?",
      icon: "/icons/notif-piggy-bank.png",
      badge: "/icons/notif-piggy-bank.png",
      data: { url: "/?action=add&type=expense" },
    });
  } catch (e) {
    /* diam */
  }
}

async function checkTodayExpense(today) {
  // Akses IDB "budgeto-v2" yang dibuat oleh app (Dexie)
  if (!self.indexedDB) return false;
  return new Promise((resolve) => {
    try {
      const open = self.indexedDB.open("budgeto-v2");
      open.onsuccess = () => {
        const idb = open.result;
        try {
          const store = idb.transaction("transactions", "readonly").objectStore("transactions");
          const idx = store.index("date");
          const req = idx.getAll(today);
          req.onsuccess = () => {
            const rows = req.result || [];
            resolve(rows.some((t) => !t.deleted && t.type === "expense"));
            idb.close();
          };
          req.onerror = () => { resolve(false); idb.close(); };
        } catch {
          resolve(false);
        }
      };
      open.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function getIdbMeta(key) {
  return new Promise((resolve) => {
    try {
      const open = self.indexedDB.open("budgeto-v2");
      open.onsuccess = () => {
        const idb = open.result;
        try {
          const req = idb.transaction("settings", "readonly").objectStore("settings").get(key);
          req.onsuccess = () => { resolve(req.result ? req.result.value : null); idb.close(); };
          req.onerror = () => { resolve(null); idb.close(); };
        } catch { resolve(null); }
      };
      open.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function setIdbMeta(key, value) {
  return new Promise((resolve) => {
    try {
      const open = self.indexedDB.open("budgeto-v2");
      open.onsuccess = () => {
        const idb = open.result;
        try {
          const tx = idb.transaction("settings", "readwrite");
          tx.objectStore("settings").put({ key, value, updatedAt: Date.now() });
          tx.oncomplete = () => { resolve(true); idb.close(); };
          tx.onerror = () => { resolve(false); idb.close(); };
        } catch { resolve(false); }
      };
      open.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}

// Klik notifikasi → buka app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
