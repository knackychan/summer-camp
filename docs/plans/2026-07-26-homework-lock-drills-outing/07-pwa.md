# Slice 07 — Installable PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Summer Quest installs to a tablet home screen (Android + iPad), opens fullscreen standalone, and the app shell loads with wifi off.

**Architecture:** Standard PWA trio — `manifest.webmanifest`, icons, `sw.js` service worker — added around the existing static site. The service worker is deliberately dumb: **network-first with cache fallback, same-origin GET only**. It never touches Supabase (cross-origin — sync.js's queue already owns offline data) and never pins versions, so GPT's frequent deploys are picked up on the next online load with no cache-busting ritual. check.mjs validates the manifest and that every precached file exists.

**Tech Stack:** Vanilla JS, zero dependencies. Icons generated once via a throwaway canvas page (no node image libs).

**Read first:** `design.md` §6. CLAUDE.md: offline-first is a non-negotiable — the SW must only ever *add* resilience, never block.

**Prerequisites:** none hard; best after slice 02 (stable `js/` file list). Needs the site deployed on HTTPS (Pages/Vercel) for real install testing.

**⚠ Concurrency:** another agent may be committing. Start clean and up to date; anchor by snippets, not line numbers.

---

### Task 1: Manifest + icons

**Files:**
- Create: `manifest.webmanifest`
- Create: `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`
- Create: `scripts/make-icons.html` (one-time generator, committed for reruns)

- [ ] **Step 1: Read the app's real colors.** Open index.html's CSS and note the values of the background/theme variables (search `:root` for `--bg` or the `body` background — dark navy) and the accent. Use the real hex values below wherever `#0F1633` / `#FFD166` appear — do not invent new colors.

- [ ] **Step 2: Create `manifest.webmanifest`**

```json
{
  "name": "Summer Quest 夏日任務",
  "short_name": "Summer Quest",
  "description": "Family summer camp — missions, games, and your day. 家庭夏令營——任務、遊戲與你的一天。",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0F1633",
  "theme_color": "#0F1633",
  "lang": "en",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Create `icons/icon.svg`** (source of truth; sun-and-star on the app's navy):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0F1633"/>
  <circle cx="256" cy="236" r="120" fill="#FFD166"/>
  <g stroke="#FFD166" stroke-width="28" stroke-linecap="round">
    <line x1="256" y1="60" x2="256" y2="96"/>
    <line x1="256" y1="376" x2="256" y2="412"/>
    <line x1="80" y1="236" x2="116" y2="236"/>
    <line x1="396" y1="236" x2="432" y2="236"/>
    <line x1="132" y1="112" x2="157" y2="137"/>
    <line x1="355" y1="335" x2="380" y2="360"/>
    <line x1="132" y1="360" x2="157" y2="335"/>
    <line x1="355" y1="137" x2="380" y2="112"/>
  </g>
  <path fill="#0F1633" d="M256 168l26 53 58 8-42 41 10 58-52-27-52 27 10-58-42-41 58-8z"/>
</svg>
```

- [ ] **Step 4: Create `scripts/make-icons.html`** (open in a browser once; it downloads the three PNGs — put them in `icons/`):

```html
<!doctype html><meta charset="utf-8"><title>Summer Quest icon baker</title>
<p>Baking icons… downloads start automatically.</p>
<script>
const SVG_URL="../icons/icon.svg";
async function bake(size,name,pad){
  const svg=await (await fetch(SVG_URL)).text();
  const img=new Image();
  img.src="data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg)));
  await img.decode();
  const c=document.createElement("canvas");c.width=c.height=size;
  const x=c.getContext("2d");
  if(pad){ /* maskable: 80% safe zone on solid bg */
    x.fillStyle="#0F1633";x.fillRect(0,0,size,size);
    const s=size*0.8,o=size*0.1;x.drawImage(img,o,o,s,s);
  }else{x.drawImage(img,0,0,size,size);}
  const a=document.createElement("a");
  a.download=name;a.href=c.toDataURL("image/png");a.click();
}
(async()=>{
  await bake(192,"icon-192.png",false);
  await bake(512,"icon-512.png",false);
  await bake(512,"icon-maskable-512.png",true);
})();
</script>
```

Serve the repo root (`npx serve .` or any static server — fetch of the SVG fails on `file://`), open `scripts/make-icons.html`, move the three downloads into `icons/`.

- [ ] **Step 5: Commit**

```bash
git add manifest.webmanifest icons scripts/make-icons.html
git commit -m "feat: PWA manifest and icons"
```

---

### Task 2: Service worker

**Files:**
- Create: `sw.js` (repo root — scope must cover `./`)

- [ ] **Step 1: Create `sw.js`**

```js
/* Summer Quest service worker — app-shell resilience ONLY.
   Strategy: network-first, cache fallback, same-origin GET only.
   NEVER handles Supabase/cross-origin — sync.js's offline queue owns data.
   No version pinning: fresh deploys win whenever the tablet is online. */
const CACHE="sq-shell-v1";
const SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./js/config.js",
  "./js/sync.js",
  "./js/day-data.js",
  "./js/time-core.js",
  "./js/lock-core.js",
  "./js/pinpad.js",
  "./js/papa-tools.js",
  "./js/drills.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install",e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    /* config.js may 404 on a fresh clone (gitignored) — cache what exists, never fail install */
    await Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=="GET"||url.origin!==self.location.origin)return; /* Supabase et al: untouched */
  e.respondWith((async()=>{
    try{
      const fresh=await fetch(e.request);
      const c=await caches.open(CACHE);
      c.put(e.request,fresh.clone());
      return fresh;
    }catch(err){
      const hit=await caches.match(e.request,{ignoreSearch:true});
      if(hit)return hit;
      if(e.request.mode==="navigate")return caches.match("./index.html");
      throw err;
    }
  })());
});
```

⚠ Keep the `SHELL` list in sync with the actual `js/` files at implementation time — if slices 03–06 haven't landed yet, remove their entries now and re-add them in those slices' commits (a stale entry is harmless thanks to the `.catch`, but don't rely on it).

- [ ] **Step 2: Wire into `index.html`.** In `<head>`, after the existing meta/title tags:

```html
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0F1633">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

(Use the real `--bg` hex from Task 1 Step 1.) At the very end of the inline script:

```js
/* PWA: register the shell worker — https/localhost only, never blocks the app */
if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))
  navigator.serviceWorker.register("sw.js").catch(()=>{});
```

- [ ] **Step 3: check.mjs guards.** Append (before the final `if (failures.length)`):

```js
try {
  const manifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", root), "utf8"));
  if (!manifest.icons?.length) fail("manifest", "no icons declared");
  for (const icon of manifest.icons) {
    try { readFileSync(new URL(icon.src, root)); }
    catch { fail("manifest", `icon file missing: ${icon.src}`); }
  }
  const sw = readFileSync(new URL("sw.js", root), "utf8");
  for (const m of sw.matchAll(/"\.\/([^"]+)"/g)) {
    if (m[1] === "" || m[1] === "js/config.js") continue; // "./" and gitignored config
    try { readFileSync(new URL(m[1], root)); }
    catch { fail("sw shell", `precache entry missing: ${m[1]}`); }
  }
} catch (error) {
  fail("pwa", error.message);
}
```

- [ ] **Step 4: Run the check**

Run: `node scripts/check.mjs` → green (manifest parses, icons exist, shell list matches reality).

- [ ] **Step 5: Commit**

```bash
git add sw.js index.html scripts/check.mjs
git commit -m "feat: service worker app shell, network-first"
```

---

### Task 3: Install + offline verification (on the deployed HTTPS site)

- [ ] **Step 1: Deploy** (push to main; Pages/Vercel auto-deploys per README).

- [ ] **Step 2: Desktop Chrome sanity** — open the deployed URL → DevTools → Application:
- Manifest panel: no warnings, installability check passes.
- Service Workers: `sw.js` activated.
- Network → Offline → reload: app shell loads, My Day renders from localStorage, games playable; Supabase requests fail silently and sync.js queues (existing behavior — verify no new console errors from the SW).

- [ ] **Step 3: Android tablet** — Chrome → deployed URL → menu → "Add to Home screen" (or the install prompt): icon shows the sun-star on navy; launch = fullscreen standalone, no address bar; airplane mode → relaunch from icon → app loads.

- [ ] **Step 4: iPad (if the family has one)** — Safari → share → "Add to Home Screen": icon + standalone launch work. Known iOS quirks are acceptable at family scale (no install prompt, SW storage may be evicted after weeks of disuse — the app still works in Safari regardless).

- [ ] **Step 5: Update path check** — push any tiny visible change; on the tablet (online) close + reopen the installed app twice: change appears by the second open (network-first, `skipWaiting`). If it doesn't, debug before closing the slice — a stale-cache trap here poisons every future deploy.

- [ ] **Step 6: Commit anything adjusted, then done.**

## DONE WHEN

- Tablets install from the deployed URL (Android install prompt or add-to-home-screen); standalone fullscreen launch; airplane-mode relaunch shows a working app (games + My Day from local state); a fresh deploy reaches an online tablet within two app opens; Supabase traffic bypasses the SW entirely; `/check` validates manifest + shell list; no regression in local-only `file://` dev (SW simply doesn't register).
