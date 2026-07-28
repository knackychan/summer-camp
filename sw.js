const CACHE_NAME = "summer-quest-v45";
const APP_SHELL = [
  "./",
  "./index.html",
  "./admin.html",
  "./css/admin-tokens.css",
  "./css/admin-shell.css",
  "./css/admin.css",
  "./css/brain-shell.css",
  "./css/brain-sprites.css",
  "./css/brain-scenes.css",
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
  "./js/brain-audio-cues.js",
  "./js/brain-ui.js",
  "./js/brain/host.js",
  "./js/brain/scenes/index.js",
  "./js/brain/scenes/generic.js",
  "./js/brain/scenes/change.js",
  "./js/game-services/scheduler.js",
  "./js/game-services/motion.js",
  "./js/game-services/audio.js",
  "./assets/brain/sprites/change.png",
  "./js/main.js",
  "./js/games/registry.js",
  "./js/games/index.js",
  "./js/games/solar-data.js",
  "./js/games/solar-sim.js",
  "./js/games/solar-quiz.js",
  "./js/games/solar.js",
  "./js/games/dig.js",
  "./js/games/city.js",
  "./js/games/hunt.js",
  "./js/games/home.js",
  "./js/games/race.js",
  "./js/games/balloon.js",
  "./js/games/orc.js",
  "./js/games/machines.js",
  "./js/games/vocab.js",
  "./js/vendor/three.core.min.js",
  "./js/vendor/three.module.min.js",
  "./js/vendor/OrbitControls.js",
  "./assets/solar/sun.jpg",
  "./assets/solar/mercury.jpg",
  "./assets/solar/venus.jpg",
  "./assets/solar/earth.jpg",
  "./assets/solar/mars.jpg",
  "./assets/solar/jupiter.jpg",
  "./assets/solar/saturn.jpg",
  "./assets/solar/uranus.jpg",
  "./assets/solar/neptune.jpg",
  "./assets/solar/iss.jpg",
  "./assets/solar/moon.jpg",
  "./assets/solar/deimos.jpg",
  "./assets/solar/io.jpg",
  "./assets/solar/europa.jpg",
  "./assets/solar/ganymede.jpg",
  "./assets/solar/callisto.jpg",
  "./assets/solar/titan.jpg",
  "./assets/solar/triton.jpg",
  "./assets/solar/pluto.jpg",
  "./assets/solar/milkyway.jpg",
  "./assets/solar/milkyway-sky.jpg",
  "./assets/solar/alphacentauri.jpg",
  "./assets/solar/sirius.jpg",
  "./assets/solar/barnardstar.jpg",
  "./assets/solar/README.md",
  "./assets/solar/tex/mercury.png",
  "./assets/solar/tex/venus.png",
  "./assets/solar/tex/earth.png",
  "./assets/solar/tex/mars.png",
  "./assets/solar/tex/jupiter.png",
  "./assets/solar/tex/saturn.png",
  "./assets/solar/tex/uranus.png",
  "./assets/solar/tex/neptune.png",
  "./assets/solar/tex/iss.png",
  "./assets/solar/tex/moon.png",
  "./assets/solar/tex/pluto.png",
  "./assets/solar/tex/README.md",
  "./assets/orc/sprites/hero.png",
  "./assets/orc/sprites/orc-grunt.png",
  "./assets/orc/sprites/orc-brute.png",
  "./assets/orc/sprites/goblin.png",
  "./assets/orc/sprites/orc-archer.png",
  "./assets/orc/sprites/troll.png",
  "./assets/orc/sprites/orc-shaman.png",
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
