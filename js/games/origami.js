/* Origami Atelier 🦢 摺紙工房 — real-paper folding guide (28 models, EN + 繁中).
   The feature itself is the vendored quickstart package in ../vendor/origami-atelier/
   (v0.2.0, kept unchanged). This file only maps it onto the game ctx contract:
   progress lives in ctx.settings, leaving the Atelier goes through the host's Back. */
import { mountOrigamiAtelier } from "../vendor/origami-atelier/origami-atelier.js";

var S = null;

function root(ctx) {
  var s = ctx.settings;
  if (!s.origami || typeof s.origami !== "object" || Array.isArray(s.origami)) s.origami = {};
  if (!s.origami.store || typeof s.origami.store !== "object") s.origami.store = {};
  if (!s.origami.locale || typeof s.origami.locale !== "object") s.origami.locale = {};
  return s.origami;
}

/* The package's storage hook: getItem / setItem / removeItem over string values. */
function settingsStorage(ctx) {
  var o = root(ctx);
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(o.store, k) ? o.store[k] : null; },
    setItem: function (k, v) { o.store[k] = String(v); ctx.saveSettings(); },
    removeItem: function (k) { delete o.store[k]; ctx.saveSettings(); }
  };
}

export default {
  id: "origami",
  meta: { icon: "🦢", title: "Origami Atelier", tz: "摺紙工房", blurb: "Fold real paper · 一步一步摺紙" },
  keyboard: false,
  bestKey: null,
  init: function (ctx) {
    var host = document.createElement("div");
    host.style.cssText = "width:100%;height:100%;overflow:auto;-webkit-overflow-scrolling:touch;border-radius:inherit";
    ctx.mount.innerHTML = "";
    ctx.mount.appendChild(host);
    var o = root(ctx);
    var handle = mountOrigamiAtelier(host, {
      profileId: ctx.kid,
      locale: o.locale[ctx.kid] === "zhHant" ? "zhHant" : "en",
      storage: settingsStorage(ctx),
      onExit: function () { if (ctx.back) ctx.back(); },
      onComplete: function () { if (ctx.sfx && ctx.sfx.good) ctx.sfx.good(); }
    });
    S = { ctx: ctx, handle: handle, host: host };
  },
  stop: function () {
    if (!S) return;
    var st = S.handle.getState();
    var o = root(S.ctx);
    if (o.locale[S.ctx.kid] !== st.locale) { o.locale[S.ctx.kid] = st.locale; S.ctx.saveSettings(); }
    S.handle.destroy();
    S.host.remove();
    S = null;
  }
};
