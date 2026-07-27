/* Admin navigation — hash routing, drawers, clock, focus preservation */
(function(){
  const $ = function(id) { return document.getElementById(id); };

  var TITLES = { today:"Today", inbox:"Inbox", stars:"Stars", kids:"Kids", content:"Content", reports:"Reports", settings:"Settings" };

  function go(route) {
    if (!TITLES[route]) route = "today";
    var locked = $("app").classList.contains("is-locked");
    document.querySelectorAll(".view").forEach(function(v) {
      v.hidden = v.id !== "view-" + route;
    });
    document.querySelectorAll(".nav a").forEach(function(a) {
      if (a.dataset.route === route) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    var title = TITLES[route];
    if (locked && route === "today") title = "Summer Quest Admin";
    $("routeTitle").textContent = title;
    var sc = $("scroll");
    if (sc) sc.scrollTop = 0;
    if (location.hash !== "#" + route) history.replaceState(null, "", "#" + route);
    closeNav();
    /* Dispatch so admin.js can re-render for the new route */
    window.dispatchEvent(new CustomEvent("sq-route", { detail: { route: route } }));
  }

  document.addEventListener("click", function(e) {
    var nav = e.target.closest(".nav a[data-route]");
    if (nav) { e.preventDefault(); go(nav.dataset.route); return; }

    var goto = e.target.closest("[data-goto]");
    if (goto) { go(goto.dataset.goto); return; }
  });

  /* ---- drawers ---- */
  function setDock(open) {
    var dock = $("dock");
    var btn = $("dockBtn");
    if (!dock) return;
    dock.classList.toggle("is-open", open);
    if (btn) btn.setAttribute("aria-expanded", String(open));
    setScrim(open || $("nav").classList.contains("is-open"));
  }

  function closeNav() {
    var nav = $("nav");
    var btn = $("navBtn");
    if (!nav) return;
    nav.classList.remove("is-open");
    if (btn) btn.setAttribute("aria-expanded", "false");
    setScrim($("dock").classList.contains("is-open"));
  }

  function setScrim(on) {
    var s = $("scrim");
    if (!s) return;
    s.hidden = !on;
    s.classList.toggle("is-on", on);
  }

  var dockBtn = $("dockBtn");
  if (dockBtn) dockBtn.onclick = function() { setDock(!$("dock").classList.contains("is-open")); };
  var dockClose = $("dockClose");
  if (dockClose) dockClose.onclick = function() { setDock(false); };

  var navBtn = $("navBtn");
  if (navBtn) navBtn.onclick = function() {
    var open = !$("nav").classList.contains("is-open");
    $("nav").classList.toggle("is-open", open);
    navBtn.setAttribute("aria-expanded", String(open));
    setScrim(open);
  };

  var scrim = $("scrim");
  if (scrim) scrim.onclick = function() { closeNav(); setDock(false); };

  addEventListener("keydown", function(e) {
    if (e.key === "Escape") { closeNav(); setDock(false); }
  });

  function syncNarrow() {
    var btn = $("navBtn");
    if (btn) btn.style.display = innerWidth <= 820 ? "inline-flex" : "none";
  }
  addEventListener("resize", syncNarrow);
  syncNarrow();

  /* ---- live Taipei clock ---- */
  function tick() {
    var now = new Date();
    var opts = { timeZone: "Asia/Taipei", weekday: "short", day: "numeric", month: "short" };
    var dateStr = now.toLocaleDateString("en-GB", opts);
    var timeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit" });
    var cd = $("clockDate");
    if (cd) cd.textContent = dateStr;
    var ct = $("clockT");
    if (ct) ct.textContent = timeStr;
  }
  tick();
  setInterval(tick, 20000);

  /* ---- focus preservation across re-render ---- */
  window.preserveFocus = function(fn) {
    var el = document.activeElement;
    var state = null;
    if (el && el.id) {
      state = { id: el.id, value: el.value, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd };
      var sc = el.closest(".scroll, .stream, .tbl-wrap");
      if (sc) state.scrollTop = sc.scrollTop;
    }
    fn();
    if (state) {
      var restored = document.getElementById(state.id);
      if (restored) {
        if (restored.value !== undefined) restored.value = state.value;
        try { restored.setSelectionRange(state.selectionStart, state.selectionEnd); } catch(e) {}
        restored.focus();
        var sc = restored.closest(".scroll, .stream, .tbl-wrap");
        if (sc && state.scrollTop !== undefined) sc.scrollTop = state.scrollTop;
      }
    }
  };

  /* ---- expose go for admin.js ---- */
  window.sqGo = go;
  window.sqSetDock = setDock;
  window.sqTitles = TITLES;

  /* Initial route from hash */
  go((location.hash || "#today").slice(1));
})();
