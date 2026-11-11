// ============================================================================
// BiblioTech Scout — Service Worker PWA (Soporte Offline & Cache Resiliente)
// Creador: Liam Durán - Provincia TLXH (ey-liam)
// Versión: V7
// ============================================================================

const CACHE_NAME = "bibliotech-scout-v12";
const STATIC_ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "img/logo-flor.png",
  "img/logo-asmac.png",
  "img/logo-wosm.png",
  "img/adc/salud.png",
  "img/adc/habilidades.png",
  "img/adc/sustentabilidad.png",
  "img/adc/paz.png",
  "data/catalog.json",
  "data/faq_v3.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo cachear peticiones GET en el mismo origen o recursos directos
  if (req.method !== "GET") return;

  // Stale-While-Revalidate para datos JSON críticos
  if (url.pathname.endsWith("catalog.json") || url.pathname.endsWith("faq_v3.json")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cachedResponse) => {
          const fetchPromise = fetch(req)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(req, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        })
      )
    );
    return;
  }

  // Cache-First para recursos estaticos
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            (url.origin === self.location.origin || url.pathname.startsWith("/covers/"))
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => {
          if (req.headers.get("accept")?.includes("text/html")) {
            return caches.match("index.html");
          }
        });
    })
  );
});
