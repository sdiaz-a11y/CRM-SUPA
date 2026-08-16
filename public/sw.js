// Service worker mínimo — su único propósito es cumplir el requisito de
// Chrome/Android para que la app sea instalable ("Agregar a pantalla de
// inicio" con ícono propio, no accesos directos de navegador). Solo cachea
// los íconos/manifest estáticos; el HTML y /api/* SIEMPRE van a la red —
// este es un CRM con datos en vivo, nunca debe servirse una respuesta vieja
// por accidente (clientes, accesos, actividad).
const CACHE = "crm-cs-shell-v1";
const ASSETS = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-512-maskable.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!ASSETS.includes(url.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copia));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
