# Slice 64 — Harnesses, Android payload, docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Retarget the WebGL-specific browser harness steps to the 2D pixel planet.
- Add toy and mini-game coverage to the world UI harness.
- Rebuild and verify the Android web payload.
- Record evidence and the remaining device checks.

**Architecture:** No runtime code changes. `check-architecture-recovery.py` (run by default through `scripts/audit-architecture-runtime.py`) changes in three ways:
- Its `webgl` failure scenario becomes `canvas`: the `data-sq-world="planet"` canvas gets a `null` 2D context.
- Its context-loss step becomes a resize-redraw step.
- Its report labels stop claiming WebGL.

The `--historical` probe in `audit-architecture-runtime.py` stays untouched, because it reproduces the original audit on purpose. Design: [design.md](design.md) "Testing and compatibility".

**Tech Stack:** Python Playwright (workstation-installed), Node 22+.

**Depends on:** slice 63.

**DONE WHEN:**
- `node scripts/check.mjs` is green.
- `python scripts/check-world-explorer-ui.py --browser "<path>" --out .tmp/world-ui` reports all PASS, including the 3 new toy/mini-game checks.
- `python scripts/audit-architecture-runtime.py --browser "<path>" --target source --out .tmp/pixel-source.json` and `--target web --out .tmp/pixel-web.json` both exit 0.
- `npm run build:android-web && node scripts/verify-android-web.mjs` passes.
- The docs are updated with real evidence, and Android device items are listed as **pending device check**, not as passed.
- Everything is committed.

---

### Task 1: Recovery harness → pixel planet

**Files:**
- Modify: `scripts/check-architecture-recovery.py` (`context_for` ~l.113–119, `world_interaction` ~l.445–450 and its `return` ~l.465, `fail_flow` ~l.549, `main` ~l.638 and ~l.659–660)

- [ ] **Step 1: Failure injection.** Replace:

```python
    if failure == "webgl":
        context.add_init_script("""(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(kind,...args) {
                return kind.startsWith('webgl') ? null : original.call(this,kind,...args);
            };
        })();""")
```

with:

```python
    if failure == "canvas":
        context.add_init_script("""(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(kind,...args) {
                return this.dataset && this.dataset.sqWorld === 'planet' ? null : original.call(this,kind,...args);
            };
        })();""")
```

- [ ] **Step 2: Context loss → resize redraw.** In `world_interaction`, replace:

```python
    page.evaluate("window.recoveryGL=document.querySelector('#worldMount canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); recoveryGL.loseContext()")
    page.wait_for_function("SummerQuest.getDiagnostics().world.contextLost")
    assert page.locator("#worldStatus").is_visible()
    page.evaluate("recoveryGL.restoreContext()")
    page.wait_for_function("!SummerQuest.getDiagnostics().world.contextLost && SummerQuest.getDiagnostics().world.running")
    assert not page.locator("#worldStatus").is_visible()
```

with:

```python
    frames = world(page)["frames"]
    page.set_viewport_size({"width": 800, "height": 600})
    page.wait_for_function("SummerQuest.getDiagnostics().world.frames > %d" % (frames + 5))
    assert canvas.bounding_box()["width"] >= 790 and not page.locator("#worldStatus").is_visible()
    page.set_viewport_size({"width": 1024, "height": 768})
```

In the same function's `return {...}`, replace `"contextRestored": True` with `"resizeRedraw": True`.

- [ ] **Step 3: Scenario names.**
  - In `fail_flow`: `if failure in ("webgl", "import"):` → `if failure in ("canvas", "import"):`.
  - In `main`, the `expected_console` dict: `"webgl": ("THREE.WebGLRenderer:", "Summer Quest 3D world failed"),` → `"canvas": ("Summer Quest 3D world failed",),`.
  - In the `scenarios` dict: `"failures": ["webgl", "import", "config", "game"]` → `"failures": ["canvas", "import", "config", "game"]`.
  - In the `report` dict: `"webgl": "desktop SwiftShader; not Android hardware evidence"` → `"world": "2D canvas pixel planet; desktop Chromium is not Android hardware evidence"`.
  - Keep the `--enable-webgl`/SwiftShader launch args, because the Solar game still uses WebGL.
  - In `main`, rename the step label `"world camera/pinch/raycast/lifecycle/resize/context restore"` to `"world camera/pinch/tap/lifecycle/resize redraw"`.

- [ ] **Step 4: Check that nothing else still says webgl**

Run: `grep -n "webgl\|WEBGL\|recoveryGL\|contextRestored" scripts/check-architecture-recovery.py`
Expected: only the browser launch args (`--enable-webgl`).

### Task 2: World UI harness → toys + mini-games

**Files:**
- Modify: `scripts/check-world-explorer-ui.py` (server ~l.18, ~l.55, after the `camera_drag_alive` result ~l.64, the `fatal=` filter near the end)

- [ ] **Step 5a: Fix the shared server cause first.** This harness already failed on this workstation before the planet (verified while planning): it timed out waiting for `.hero` / `#worldMount canvas`. The cause is its single-threaded `socketserver.TCPServer`. The runtime fetches dozens of ES modules at once, and the overflow is refused (`net::ERR_CONNECTION_REFUSED`). Replace:

```python
        httpd = socketserver.TCPServer(("127.0.0.1", port), QuietHandler)
```

with:

```python
        # Threaded: the runtime loads dozens of ES modules at once and a single-threaded
        # server refuses the overflow (ERR_CONNECTION_REFUSED), which looked like a dead world.
        socketserver.ThreadingTCPServer.allow_reuse_address = True
        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), QuietHandler)
```

- [ ] **Step 5b: Ignore unreachable remote resources, like the recovery harness does.** The bundle may reference remote fonts or a configured Supabase host. In a sandboxed or offline run, these log `Failed to load resource: net::ERR_NAME_NOT_RESOLVED`, which says nothing about the world. Replace:

```python
    fatal=[e for e in errors if "favicon" not in e.lower()]
```

with:

```python
    fatal=[e for e in errors if "favicon" not in e.lower() and "Failed to load resource" not in e]
```

- [ ] **Step 5:** Rename the result id `"webgl_canvas"` to `"world_canvas"`. Change the comment `# Camera interaction: a drag should keep a healthy WebGL surface.` to `# Camera interaction: a drag should keep a healthy planet surface.`

- [ ] **Step 6:** Directly after the `results.append(("camera_drag_alive", ...))` line, insert:

```python
        # Toys react in place; a sparkly toy opens a mini-game that native Back ends (design D7/D8).
        diag="SummerQuest.getDiagnostics().world"
        snap=page.evaluate(diag)
        toy=next((t for t in snap["toys"] if t["visible"]),None)
        if toy: page.mouse.click(toy["x"],toy["y"]); page.wait_for_timeout(150)
        results.append(("toy_tap_stays_on_world", toy is not None and visible(page,"#world") and page.evaluate(diag+".minigame") is None))
        game_toy=None
        for _ in range(12):
            snap=page.evaluate(diag)
            game_toy=next((t for t in snap["toys"] if t["visible"] and t["id"] in ("toy:whale","toy:molehill","toy:echo-stone")),None)
            if game_toy: break
            page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x-60,y,steps=6); page.mouse.up(); page.wait_for_timeout(1500)
        if game_toy:
            page.mouse.click(game_toy["x"],game_toy["y"]); page.wait_for_timeout(200)
            page.locator("#worldGo").click(); page.wait_for_timeout(300)
        results.append(("minigame_starts", page.evaluate(diag+".minigame") is not None))
        handled=page.evaluate("window.SQPlatform.triggerBack()")
        results.append(("back_ends_minigame", handled is True and visible(page,"#world") and page.evaluate(diag+".minigame") is None))
```

`x`/`y` are the drag coordinates computed just above it. The search loop spins the planet about 60 px per try until a game toy faces the camera. In the planning harness it found the echo stone within a few tries.

- [ ] **Step 7: Run both harnesses**

```powershell
npm run build:android-web
python scripts/check-world-explorer-ui.py --browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --out .tmp/world-ui
python scripts/audit-architecture-runtime.py --browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --target source --out .tmp/pixel-source.json
python scripts/audit-architecture-runtime.py --browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --target web --out .tmp/pixel-web.json
```

Expected: all `PASS`, and exit code 0 for each. While planning, a throwaway worktree with slices 60–64 applied produced:
- **World UI harness:** 16/16 PASS, including `toy_tap_stays_on_world`, `minigame_starts` and `back_ends_minigame`.
- **Recovery audit:** every step PASS on both `source` and `web`, including world drag/pinch/tap/lifecycle/resize, every catalog entry from the world, and the `canvas` failure scenario.

`node scripts/check.mjs` can flake on `agent-local-server`/`knowledge-help` under heavy load. If it does, rerun it once before investigating.

If a recovery step fails:
- **Drag-delta, pinch or reload assertions:** compare `snapshot().camera` before and after. These fields are designed to keep their meaning, so a failure is a real bug in slice 63, not a harness problem.
- **Unexpected console errors:** the only expected world error string is `Summer Quest 3D world failed` (from `index.html`'s `openWorld` catch).

- [ ] **Step 8: Commit**

```bash
git add scripts/check-architecture-recovery.py scripts/check-world-explorer-ui.py
git commit -m "test(world): retarget browser harnesses to the pixel planet"
```

### Task 3: Android payload + docs

**Files:**
- Modify: `apps/android/ACCEPTANCE-CHECKLIST.md` (~l.44–46, 60, 71)
- Modify: `docs/audits/SUMMER-QUEST-ARCHITECTURE-RECOVERY-RESULTS.md` (append a section)
- Modify: `docs/plans/2026-10-02-pixel-planet/design.md` (status line)

- [ ] **Step 9: Rebuild and verify the web payload**

Run: `npm run build:android-web` then `node scripts/verify-android-web.mjs`. Expected: passes. The new `js/world/planet-*.js` files ship automatically, because `js/` is a source directory.

Only if a device session is planned, also run `npm run android:sync` and `node scripts/verify-android-web.mjs apps/android/android/app/src/main/assets/public --native`. Never uninstall the app or clear app data (see `apps/android/README.md`).

- [ ] **Step 10: Android checklist.** In `apps/android/ACCEPTANCE-CHECKLIST.md`:

Replace:
```md
- [ ] Hero → **Miniature 3D World** opens as the primary child surface.
- [ ] Drag rotates/looks around the world; pinch zoom remains bounded and stable.
- [ ] Tap at least three physical landmarks/props and confirm the selection card updates.
```
with:
```md
- [ ] Hero → **Pixel Planet** opens as the primary child surface (pixel globe on a starfield, crisp pixels, no blur).
- [ ] Drag spins the globe in any direction, a flick coasts, the planet rights itself; pinch zoom stays bounded (1×–2×) and springs back at the limits.
- [ ] Tap at least three places: the planet turns to centre each, the hero hops, the selection card updates with bilingual text.
- [ ] Tap at least five toys: each plays its animation + sound (silent with Sound off) + haptic, never opens content, never awards stars.
- [ ] Moon / whale / molehill / echo stone open a mini-game card; **GO** plays it in place; **Done 完成** and time-up (**Yay! 好棒！**, **OK 好**) both return to the planet.
- [ ] Frame pacing feels smooth while spinning and during a mini-game (note any stutter with device model).
```

Replace `- [ ] From content launched from the 3D world, Android Back returns to the 3D world rather than immediately closing the app.` with:
```md
- [ ] From content launched from the planet, Android Back returns to the planet rather than immediately closing the app.
- [ ] During a planet mini-game, Android Back ends the game and stays on the planet.
```

Replace `- [ ] Rotate the world camera before orientation change and confirm the 3D scene recovers without a black canvas.` with:
```md
- [ ] Spin the planet before an orientation change and confirm it redraws at the new size with crisp pixels and the same pose.
```

- [ ] **Step 11: Results doc.** Append to `docs/audits/SUMMER-QUEST-ARCHITECTURE-RECOVERY-RESULTS.md` a section headed `## Pixel Planet world (<date>)` containing:
  - the commands from steps 7 and 9, each with its actual outcome (PASS/FAIL counts, exit codes);
  - one sentence saying the world now renders on a 2D canvas, the `webgl` failure scenario became `canvas`, and context loss became resize-redraw;
  - a line saying physical tablet checks (touch feel, frame pacing, audio, haptics, Back during a mini-game) are **pending device check**.

  Write only what you actually ran and saw.

- [ ] **Step 12: Design status.** In `docs/plans/2026-10-02-pixel-planet/design.md`, change the `**Status:**` line to append `· Implemented (slices 60–64, <date>); tablet acceptance pending.`

- [ ] **Step 13: Final gate + commit**

Run: `node scripts/check.mjs` — expected: green.

```bash
git add apps/android/ACCEPTANCE-CHECKLIST.md docs/audits/SUMMER-QUEST-ARCHITECTURE-RECOVERY-RESULTS.md docs/plans/2026-10-02-pixel-planet/design.md
git commit -m "docs(world): record pixel planet evidence and device checklist"
```

Never stage `.tmp/`, `dist/`, `apps/android/.reports/`, APKs or screenshots.
