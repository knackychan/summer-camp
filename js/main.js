/* ESM host (design.md §4). Publishes the registry for the inline script to
   find, and guards the manifest against drifting from the inline LEVELS. */
import { SQGames } from "./games/registry.js";
import { MANIFEST, findEntry } from "./games/index.js";

window.SQGames = SQGames;
window.SQManifest = MANIFEST;

/* sync.js cannot import us, so hand it the predicate (design.md §5). */
if (window.SyncStore && window.SyncStore.setBestStatCheck) {
  window.SyncStore.setBestStatCheck(function (key) {
    return SQGames.isBest(key) || MANIFEST.some(function (e) { return e.bestKey === key; });
  });
}

/* Lazily load and register one game module. Returns the game, or null when the
   id has no module yet — that is the normal case for a game still living in
   index.html, and the caller falls back to the legacy path. */
var loading = {};
window.SQLoadGame = function (id) {
  if (SQGames.has(id)) return Promise.resolve(SQGames.get(id));
  var entry = findEntry(id);
  if (!entry || entry.brain || entry.legacy !== false) return Promise.resolve(null);
  if (!loading[id]) {
    loading[id] = import("./games/" + id + ".js")
      .then(function (mod) { return SQGames.register(mod.default); })
      .catch(function (err) {
        delete loading[id];
        console.error("game module failed to load: " + id, err);
        return null;
      });
  }
  return loading[id];
};

/* Dev-flag spinning-cube probe — proves the 3D seam on a real tablet (slice 21).
   Not in the manifest, not in the grid, costs nothing unless the flag is set. */
if (location.hash === "#devcube") {
  import("./games/cube.js").then(function (mod) {
    SQGames.register(mod.default);
    var host = window.SQHost;
    var kidId = host.kid || (host.KIDS && Object.keys(host.KIDS)[0]);
    if (!kidId) { console.error("devcube: no kid selected — open a kid hub first"); return; }
    var game = SQGames.get("cube");
    if (!game) { console.error("devcube: failed to register cube"); return; }
    window.currentGame = game;
    game.init({
      kid: kidId, mount: host.mount(), stage: host.stage(),
      hud: host.hud, say: host.say, sayPair: host.sayPair,
      sfx: host.sfx, keys: host.keys, fx: host.fx,
      settings: host.settings, rand: host.rand, shuffle: host.shuffle,
      finish: function () {}
    });
  }).catch(function (err) { console.error("devcube: load failed", err); });
}

/* Drift guard: the manifest and the inline LEVELS must agree while both exist.
   Slice 20 deletes LEVELS and this check with it. */
(function guard() {
  var L = window.SQHost && window.SQHost.LEVELS;
  if (!L) return;
  var missing = MANIFEST.filter(function (e) { return !L[e.id]; }).map(function (e) { return e.id; });
  var extra = Object.keys(L).filter(function (id) { return !findEntry(id); });
  if (missing.length || extra.length) {
    console.error("manifest/LEVELS drift — missing:", missing, "extra:", extra);
  }
})();
