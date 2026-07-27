const CACHE_NAME = "summer-quest-v16";
const APP_SHELL = [
  "./",
  "./index.html",
  "./admin.html",
  "./css/admin-tokens.css",
  "./css/admin-shell.css",
  "./css/admin.css",
  "./js/config.js",
  "./js/day.js",
  "./js/day-data.js",
  "./js/act-data.js",
  "./js/learn-data.js",
  "./js/time-core.js",
  "./js/chat-core.js",
  "./js/lock-core.js",
  "./js/pinpad.js",
  "./js/papa-tools.js",
  "./js/drills.js",
  "./js/admin-nav.js",
  "./js/admin.js",
  "./js/sync.js",
  "./js/brain-data.js",
  "./js/brain-core.js",
  "./js/brain-ui.js",
  "./js/games/solar-data.js",
  "./manifest.webmanifest",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.all(
      APP_SHELL.map(url =>
        fetch(url, {cache: "reload"})
          .then(response => response.ok ? cache.put(url, response) : null)
          .catch(() => null)
      )
    ))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const {request} = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for EVERY same-origin GET, not just navigations. Cache-first on
  // scripts meant tablets kept running the previous deploy's JS until someone did a
  // hard reload. js/config.js is handled here too: leaving it to the browser's HTTP
  // cache is what made F5 show "Config needed" while ctrl+shift+R worked.
  const offline = request.mode === "navigate"
    ? cached => cached || caches.match("./index.html")
    : cached => cached;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(offline))
  );
});
