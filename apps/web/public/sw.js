/* TDrive Service Worker — offline-first runtime cache */
const CACHE = "tdrive-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Hanya same-origin; API/SSE selalu network (fresh data)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/sse") || url.pathname.startsWith("/auth")) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((m) => {
          if (m) return m;
          // Navigasi offline: fallback ke halaman kunci (dashboard/login)
          if (req.mode === "navigate") {
            return caches.match("/dashboard").then((d) => d || caches.match("/"));
          }
          return Response.error();
        })
      )
  );
});
