// ============================================================================
// BiblioTech Scout — Service Worker PWA (Soporte Offline & Cache Resiliente)
// Creador: Liam Durán - Provincia TLXH (ey-liam)
// Versión: 9.9.2
// ============================================================================

const CACHE_NAME = "bibliotech-scout-v59";
const STATIC_ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "version.json",
  "manifest.webmanifest",
  "img/logo-flor.png",
  "img/logo-asmac.png",
  "img/logo-wosm.png",
  "img/apple-touch-icon.png",
  "img/qr-bibliotech.png",
  "img/qr-bibliotech.svg",
  "img/adc/salud.png",
  "img/adc/habilidades.png",
  "img/adc/sustentabilidad.png",
  "img/adc/paz.png",
  "img/forms/salud_p1.webp",
  "img/forms/salud_p2.webp",
  "img/forms/jl304_p1.webp",
  "img/forms/jl304_p2.webp",
  "img/forms/fes_p1.webp",
  "img/forms/smart_p1.webp",
  "img/forms/smart_p2.webp",
  "img/forms/programa_p1.webp",
  "img/forms/acta_p1.webp",
  "img/forms/acta_p2.webp",
  "img/forms/p1_p1.webp",
  "img/forms/p2_p1.webp",
  "img/forms/p8_p1.webp",
  "img/forms/p9_p1.webp",
  "img/forms/vales_p1.webp",
  "data/catalog.json",
  "data/knowledge_base.json",
  "data/faq_v3.json",
  "data/spreadsheets.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

function isFreshFirstRequest(req, url) {
  if (req.mode === "navigate") return true;
  const p = url.pathname;
  return (
    p.endsWith("/") ||
    p.endsWith(".html") ||
    p.endsWith(".css") ||
    p.endsWith(".js") ||
    p.endsWith(".webmanifest") ||
    p.endsWith(".json")
  );
}

function fetchWithTimeout(req, timeoutMs) {
  if (typeof AbortController === "undefined") {
    return fetch(req, { cache: "no-cache" });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    try {
      ctrl.abort();
    } catch (_) {}
  }, timeoutMs);
  return fetch(req, { cache: "no-cache", signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Network-First con timeout corto anti lie-fi para HTML, CSS, JS y JSON
  if (isFreshFirstRequest(req, url)) {
    const isHeavyJson = /questions_bank\.json|faq_v4\.json|chunks\.json/i.test(url.pathname);
    const timeoutMs = isHeavyJson ? 4500 : 2600;
    event.respondWith(
      fetchWithTimeout(req, timeoutMs)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
              return caches.match("index.html", { ignoreSearch: true }).then(
                (fallback) => fallback || new Response("Offline", { status: 503, statusText: "Offline" })
              );
            }
            return new Response("Offline", { status: 503, statusText: "Offline" });
          })
        )
    );
    return;
  }

  // Cache-First con llenado para portadas e imágenes estáticas
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => new Response("Offline", { status: 503, statusText: "Offline" }));
    })
  );
});
