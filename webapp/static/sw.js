/* Service worker: guarda la app en el teléfono para que abra sin señal.
   Las peticiones a /api nunca se cachean; de eso se encarga la cola de envío. */

const CACHE = "uc-familia-v7";

// Lo indispensable para que la app abra sin señal: son archivos pequeños.
const BASICOS = [
  "/", "/static/css/app.css", "/static/js/app.js", "/static/js/dibujo.js",
  "/static/img/ucaldas.png", "/static/manifest.json", "/consentimiento"
];

// Pesados (la librería que lee el .docx y el documento). Se guardan DESPUÉS de
// activar y sin `waitUntil`: si se descargan durante la instalación, dejan
// esperando las peticiones que la página está haciendo en ese mismo momento.
const EXTRAS = [
  "/static/js/vendor/mammoth.browser.min.js",
  "/static/docs/consentimiento-informado.docx"
];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
  // Sin waitUntil a propósito: se descarga en segundo plano y no bloquea nada
  caches.open(CACHE).then(c => c.addAll(EXTRAS)).catch(() => {});
});

self.addEventListener("fetch", ev => {
  const url = new URL(ev.request.url);
  if(ev.request.method !== "GET" || url.pathname.startsWith("/api")) return;

  // Red primero y, si no hay señal, lo guardado
  ev.respondWith(
    fetch(ev.request)
      .then(r => {
        if(r.ok && url.origin === self.location.origin){
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(ev.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(ev.request).then(r => r || caches.match("/")))
  );
});
