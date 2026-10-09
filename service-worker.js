const CACHE_NAME = "wecco-app-v5";
const APP_FILES = [
  "./",
  "./index.html",
  "./presentation-partenaire.html",
  "./presentation.css",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg?brand=wecco-v2",
  "./apple-touch-icon.png?brand=wecco-v2",
  "./icon-192.png?brand=wecco-v2",
  "./icon-512.png?brand=wecco-v2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)),
      self.skipWaiting(),
    ]),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith("change-mobile-prototype-") ||
                key.startsWith("wecco-app-")) &&
              key !== CACHE_NAME,
          )
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request);
      }),
    ),
  );
});
