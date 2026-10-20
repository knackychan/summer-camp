# Terrain Painter: implementation plan

> For the builder: follow the slices in order and use TDD where there is pure logic. After every edit under `js/`, run `node scripts/check.mjs`. If it is red, do not commit. Commit straight to `main`, only the paths you changed (other sessions share this tree). Use conventional commits, one per slice or smaller.

**Goal:** a 🖌️ Ground 地面 tool in Brick Lab that paints the 64×64 baseplate cell by cell with 8 terrains plus an eraser, saved per world, undoable, and shared when building together.

**Design:** `design.md` (D1–D9, approved by Papa 2026-10-20).

**Code facts this plan relies on (checked 2026-10-20):**
- `js/brick-lab/brick-lab.js` (5026 lines): `BASE_HALF = 32` (line 187), so the plate is 64×64 studs and has 4096 cells.
- The plate is `this.ground`, a `bevelBox(64, 0.42, 64)` mesh in `BASEPLATE_GREEN` 0x4b9f4a (around line 1885).
- Studs are one `InstancedMesh` `this.baseStudMesh` (`addBaseplateStuds`, line 2093). Instances are filled with x outer, z inner: `i = (x+31.5)*64 + (z+31.5)`.
- On cheap tiers and after step-down, `paintStuds()` (line 2040) swaps the plate to `[paintedStuds(), plain]`: a 64-px canvas stud tile repeated over the top face, with the instanced studs hidden.
- `openWorld(id)` (line 3040) loads pieces, then `createSequencer({ world: this.pieces, rules })`.
- Edits go `change(op)` → `commit(op)` → `sequencer.submit` → `showOp`. Solo undo is `recordHistory()` (a snapshot of pieces, at most 40) and `undo()` (line 4741). Shared undo uses inverse ops (`together.undo`).
- `js/brick-lab/brick-share.js`: `checkOp` / `applyOp` / `createSequencer` / `createClient`, `PROTO = 7`, `BATCH_MAX = 64`.
- `js/brick-lab/brick-together.js`: `welcome(joining)` splits the world into lines of at most `LINE_MAX` (64 KB), keeping `LINE_MAX − 4096` for pieces. The guest side is `guestWorld`, with `createClient({ world: this.lab.pieces })` at line 376.
- `js/brick-lab/brick-storage.js`: `buildPayload(state)` / `readBuild(raw)`, `BUILD_VERSION = 1`. `brick-worlds.js`: `load(id)`, save at around line 132.
- Tests live in `scripts/*.test.mjs` and `check.mjs` runs all of them (line 733): `brick-share.test.mjs`, `brick-worlds.test.mjs`, `brick-together.test.mjs`, and so on. The UI check is `scripts/check-brick-lab-ui.py`.

**Cell index (used everywhere):** `cell(ix, iz) = ix * 64 + iz`, where `ix = floor(x + 32)` and `iz = floor(z + 32)` for world x, z in [−32, 32). This is the same order as the stud instances, so stud instance `i` is cell `i`.

---

## Slice 01: ground data + pure logic

**Files:** create `js/brick-lab/brick-ground.js` and `scripts/brick-ground.test.mjs`. Modify `js/brick-lab/brick-storage.js` and `js/brick-lab/brick-worlds.js`, and extend `scripts/brick-worlds.test.mjs`.

1. **Write the failing tests first** (`scripts/brick-ground.test.mjs`, `node:test` + `assert`, same style as `brick-rails.test.mjs`):
   - `TERRAINS` has 9 entries (plain + 8). Letters are unique, single ASCII, and `.` is plain. Every entry has a non-empty `en` and `zh`, and `color` is an int.
   - `PLAIN` is 4096 dots. `cleanGround(undefined | 42 | "x" | "a".repeat(4096))` returns `PLAIN`, or the string with unknown letters turned into `.`.
   - `brushCells(ix, iz, "S")` gives exactly `[cell(ix,iz)]`. `"M"` gives a radius-2 disc of 13 cells in the middle of the plate. `"L"` gives a radius-5 disc of 81 cells (cells whose centre satisfies dx²+dz² ≤ r²+r·0.5; pin the exact counts in the test). At corner (0,0) the result is clipped, with no index < 0 or ≥ 4096. The result is sorted and has no duplicates.
   - `applyCells(ground, idx, letter)` returns `{ ground: next, undo: { idx, was } }` holding **only the cells that changed**. Applying the undo restores the original string. Painting the same letter twice changes nothing (empty idx).
   - `strokeMerge(a, b)` merges two `{idx, was}` undo records, keeping the *first* `was` of each cell, so one whole stroke undoes to the state before it started.
2. **Implement `brick-ground.js`** (pure, no Three, no DOM):
   ```js
   export const GRID = 64;            // cells per side (BASE_HALF * 2)
   export const CELLS = GRID * GRID;  // 4096
   export const PLAIN_LETTER = ".";
   export const TERRAINS = [
     { id: "plain",   letter: ".", color: 0x4b9f4a, en: "Eraser",     zh: "橡皮擦" },
     { id: "grass",   letter: "g", color: 0x5cb85c, en: "Grass",      zh: "草地" },
     { id: "dirt",    letter: "d", color: 0x8a5a33, en: "Dirt",       zh: "泥土" },
     { id: "sand",    letter: "s", color: 0xe8d28c, en: "Sand",       zh: "沙子" },
     { id: "water",   letter: "w", color: 0x3d8fd6, en: "Water",      zh: "水" },
     { id: "snow",    letter: "n", color: 0xf4f7fb, en: "Snow",       zh: "雪" },
     { id: "stone",   letter: "p", color: 0x9aa0a6, en: "Stone path", zh: "石板路" },
     { id: "lava",    letter: "l", color: 0xe0531f, en: "Lava",       zh: "岩漿" },
     { id: "flowers", letter: "f", color: 0x6cc36a, en: "Flowers",    zh: "花地", dots: [0xf06292, 0xffd54f, 0xffffff] },
   ];
   export const BRUSH = { S: 0, M: 2, L: 5 };
   export const PLAIN = PLAIN_LETTER.repeat(CELLS);
   export const cellAt = (x, z) => /* world coords → index or -1 */;
   export function cleanGround(raw) { /* … */ }
   export function brushCells(ix, iz, size) { /* … */ }
   export function applyCells(ground, idx, letter) { /* … */ }
   export function strokeMerge(a, b) { /* … */ }
   export const terrainOf = (letter) => /* entry, plain if unknown */;
   ```
   The plain colour must equal `BASEPLATE_GREEN`. Export that constant from one place, or assert they match in the test. Grass has to look different from plain, so it is a lighter, yellower green.
3. **Storage:** in `buildPayload`, add `ground: typeof state.ground === "string" && state.ground !== PLAIN ? state.ground : undefined`, so a plain plate saves nothing and old payloads stay the same. In `readBuild`, leave `ground` alone; the lab cleans it. **Do not bump `BUILD_VERSION`.** The field is additive, and `readBuild` rejects other versions, so a bump would hide old worlds.
4. **Worlds:** wherever `brick-worlds.js` builds or saves a payload (around lines 85 and 121–132), pass `ground` through. Default empty world: `ground` absent.
5. **Extend `brick-worlds.test.mjs`:** a world saved with ground comes back with the same string. A legacy world with no `ground` loads, and `cleanGround(saved.ground) === PLAIN`.
6. Run `node scripts/check.mjs` (green). Commit `feat(brick-lab): ground data and brush maths`.

**DONE WHEN:** the tests above pass in `check.mjs`; old saved worlds load unchanged; nothing visible changes yet.

---

## Slice 02: draw the painted ground

**Files:** modify `js/brick-lab/brick-lab.js` (renderer side only). Optionally put the drawing helpers in a new `js/brick-lab/brick-ground-view.js` to keep `brick-lab.js` from growing; it exports `createGroundView(lab)`.

1. **State:** in the constructor next to `this.studsPainted`, add `this.groundCells = PLAIN;`.
2. **Full tier (instanced studs visible):**
   - Plate top colour: add one `PlaneGeometry(64, 64)` rotated −π/2 at `y = 0.002` above the plate top (the plate is centred at −0.21 with height 0.42, so its top is at 0). Its material is `kit.mat(0xffffff, 0.55)` with `map = DataTexture(Uint8Array(64*64*4), 64, 64)`, `magFilter = minFilter = NearestFilter`, `generateMipmaps = false`, and the colour space matching the other textures in `three-runtime.js`. Set `raycast` on the plane so the plate's ground raycast still works: either give the plane `userData.sqblGround = true` or make it non-raycastable (`raycast = () => {}`). Pick the second, so placement code is untouched.
   - Texel order: the DataTexture row is `iz`, the column is `ix`, with flipY taken into account. Write one unit check in the browser: paint cell (0,0) and confirm it appears at the −x,−z corner.
   - Studs: `baseStudMesh.setColorAt(i, colorOf(letter))` for every changed cell, then `instanceColor.needsUpdate = true`. At creation, call `setColorAt` once for all 4096 cells with the plain colour, so `instanceColor` exists. The stud material colour must be white for instance colours to show, so give the studs their **own** material (`kit.mat(0xffffff, 0.55)`) instead of sharing `plastic`, and colour the plain cells `BASEPLATE_GREEN`.
   - Flowers: `dots` add no geometry. Bake them into the plane texture by making the DataTexture 128×128 (2×2 texels per cell), where one texel of each flowers cell takes a dot colour picked by `(i * 2654435761) >>> 29`, so the result is deterministic. Stone path: one darker texel per cell, the same way. All other terrains are flat.
3. **Cheap / stepped-down tier (`paintStuds()` active):**
   - The painted-stud canvas tile is grey-white and multiplied by the material colour. Set the material that carries it to colour white, and give it `map` = the stud tile (repeat 64) plus a second texture holding the terrain colours. Three's standard material has only one map slot, so instead:
   - **Chosen approach:** in painted mode, the terrain plane above (step 2) stays, and the painted-stud layer becomes a second transparent plane at `y = 0.004` with the stud tile as an `alphaMap`-style shading overlay: the canvas drawn as dark rim + light highlight on a transparent background, with `transparent: true`, `depthWrite: false`, repeat 64. Change `paintedStuds()` to draw on a transparent background in that case, and keep the old opaque path when there is no ground plane. Check with `scripts/check-android8-ui.py` that this does not drop frames on the reduced tier.
   - Simpler fallback if the overlay looks wrong: in painted mode, recolour only the plane and accept flat studs, because this tier exists for slow tablets.
4. **API:** `setGround(next)` diffs `this.groundCells` against `next`, rewrites only the changed texels and stud colours, sets `needsUpdate`, stores `next`, and calls `this.requestRender()` (or the existing draw-on-demand call; grep `requestRender|needsRender|invalidate`).
5. **Load:** in `openWorld`, after the pieces, call `this.setGround(cleanGround(saved.ground))`. In `clearPlate()`, call `this.setGround(PLAIN)`.
6. **Dispose:** the new geometries, materials and textures are freed in `destroy()` alongside the other kit resources (follow the comment at line 323).
7. **Debug hook:** add `ground: this.groundCells` to `snapshot()` (line 4870) for the harnesses, plus a dev-only `window.__sqbl?.paintTest()` if a harness hook already exists. Don't add a new global.
8. **Check:** seed a world in devtools with all 9 letters in stripes and take screenshots in Chrome 138 on (a) WebGL2 full tier, (b) `?three=legacy` / the r162 WebGL1 path, (c) forced cheap tier. Run `python scripts/check-android8-ui.py` and `python scripts/check-brick-lab-ui.py`. Idle frame count must stay 0 (on demand).
9. `check.mjs` green. Commit `feat(brick-lab): draw painted ground cells`.

**DONE WHEN:** all 8 terrains show correctly on the three render paths; nothing redraws while idle; the step-down tiers still work; bricks still place exactly as before.

---

## Slice 03: Ground tool + brush UI

**Files:** modify `js/brick-lab/brick-lab.js` and `css/brick-lab.css`, and extend `scripts/check-brick-lab-ui.py`.

1. **Strings** (in the `HINTS`-style tables near the top of `brick-lab.js`, every one with EN + 中文):
   - `groundTool: ["Ground", "地面"]`
   - `groundHint: ["Drag one finger to paint the ground. Two fingers move the view.", "用一根手指拖著畫地面，兩根手指移動畫面。"]`
   - `brushS/M/L: ["Small","小"], ["Medium","中"], ["Big","大"]`
   - `groundDone: ["Done painting", "畫好了"]`
   - Terrain names come from `TERRAINS`.
2. **Entry:** a rail category tile 🖌️ "Ground 地面", placed directly after Favourites ⭐ in the category list (`railView === "categories"`). Tapping it sets `this.railView = "ground"`, which renders the ground panel in the rail with the existing Back to categories. Don't add a new top-bar button.
3. **Ground panel** (in the rail, coarse pointer, ≥ 56 px targets):
   - A 3-column grid of 9 swatch tiles: a colour chip plus the EN name and the 中文 name under it. The selected tile gets a thick outline, and the eraser is last.
   - A row of 3 size buttons (S / M / L) with a dot icon in 3 sizes and the bilingual label.
   - "✓ Done painting 畫好了", which returns to categories and leaves the mode.
   - Remember `prefs.groundTerrain` and `prefs.groundSize` through the existing `cleanPrefs` / `savePrefs` (add both to `cleanPrefs` with defaults `"grass"` and `"M"`).
4. **Ground mode:** `this.painting = { terrain, size }` while the panel is open. On entering, deselect the piece, disarm placement (`placementArmed = false`) and show `groundHint`. Leaving happens through Done, Back, `setMode("explore")`, opening the walk, or opening another world, and it clears `painting` and the ring.
5. **Input** (find the stage pointer handlers that call into `brick-camera.js`; around the `pointerdown` / `INPUT_EVENTS` code at line 192 and the camera hand-off):
   - While `this.painting` is set and **exactly one** pointer is down on the stage, the one-finger ground-slide of the kid camera is skipped. Raycast `this.ground` (the plate mesh, which stays raycastable) and get world x, z, then `cellAt`, then `brushCells`, then `applyCells` on a local *pending* copy, then `setGround` (preview at once).
   - pointermove: sample the line between the last and the current cell (Bresenham over cells) so fast drags leave no gaps. Throttle the texture upload to one per animation frame.
   - When a second pointer comes down: **cancel the stroke** (restore the ground from before it) and hand both pointers to the camera as today. Then two fingers do pinch / twist / slide.
   - pointerup or pointercancel ends the stroke and hands it to slice 04's `commitStroke`. Until slice 04 lands, keep it local only.
   - A tap (down/up with no movement) paints one stamp.
   - No hover anywhere. The ring shows only while a finger is down.
6. **Brush ring:** a `RingGeometry` lying flat at `y = 0.05` with radius `(r + 0.5)` cells, white at 70 % opacity, `depthTest: false`, and a DOM label above the finger in the same style as `bubble`, showing the terrain emoji-chip plus `en · zh`. The ring follows the touched cell centre and hides on pointerup.
7. **Out of bounds:** a touch off the plate paints nothing and the ring hides.
8. **UI check:** extend `check-brick-lab-ui.py`: open Brick Lab, open Ground, pick water size L, drag across the middle, and assert `snapshot().ground` changed in a disc. Simulate two pointers and assert nothing was painted and the camera moved. Check at 1280×800 and in portrait 800×1280; the rail must not overflow.
9. `check.mjs` green (the bilingual gate catches a missing 中文). Commit `feat(brick-lab): Ground tool and brush`.

**DONE WHEN:** a kid can paint, erase and change size by finger; two fingers never paint; the UI works in landscape and portrait; nothing depends on hover.

---

## Slice 04: undo + save

**Files:** `js/brick-lab/brick-lab.js`, `js/brick-lab/brick-share.js` and `scripts/brick-share.test.mjs`. The ground op is solo here and shared in 05; it goes through the same sequencer either way, so 05 only adds the wire.

1. **Op shape** (add it to the header comment in `brick-share.js`):
   `{ type: "ground", idx: number[], to: string }`. `idx` is sorted unique cells, and `to` is the letter for each, the same length as `idx`. Its inverse has the same shape with the old letters. Limit: `idx.length ≤ CELLS`.
2. **World holder:** the sequencer's `world` is a `Map` of pieces. Don't put the ground inside it, because every place that iterates pieces would see it. Instead:
   - `createSequencer({ world, rules, seq, ground })` and `createClient({ world, seq, ground })` take an optional `ground = { cells: string }` box.
   - `checkOp`: the `case "ground"` checks the arrays (ints in range, ascending, same lengths, letters in `TERRAINS`) and returns `"shape"` otherwise. It needs `rules.ground === true` (otherwise `"shape"`), so an old peer can't send a ground op to a sequencer that doesn't know it.
   - `applyOp(op, world, ground)`: a `case "ground"` builds the new string, returns the inverse `{type:"ground", idx, to: oldLetters}` and stores the result in `ground.cells`. Every existing call passes the box along. `batch` does **not** accept ground members; that stays out of scope.
   - Tests in `brick-share.test.mjs`: a valid op applies and its inverse restores; a bad letter, an out-of-range index, unsorted indexes or mismatched lengths give `"shape"`; `rules.ground` missing gives `"shape"`; the sequencer and client both update the ground box.
3. **Lab wiring:**
   - `openWorld`: `this.groundBox = { cells: cleanGround(saved.ground) }`, passed to `createSequencer`, and `shareRules()` adds `ground: true`.
   - `showOp(op)`: `if (op.type === "ground") this.setGround(this.groundBox.cells)`.
   - `commitStroke(stroke)`: build `{type:"ground", idx, to}` from the stroke's changed cells (each cell's final letter), first putting the preview back to `before`, then `this.change(op)`. Solo `change` calls `recordHistory()` first.
   - `recordHistory()`: the snapshot becomes `{ pieces: [...], ground: this.groundCells }`. `undo()`: restore pieces as today, then `this.groundBox.cells = snapshot.ground; this.setGround(snapshot.ground)`. Keep the old array-snapshot shape readable for one release (`Array.isArray(snapshot) ? { pieces: snapshot } : snapshot`). Grep every `this.history` user (redo, if any; assemblies) and update them.
   - Save: wherever the lab builds its save state for `buildPayload` / `worlds.save` (grep `buildPayload(` and `saveNow`), add `ground: this.groundBox.cells`. A stroke calls the existing `scheduleSave()`.
   - Thumbnails (`captureThumb`) pick up the ground automatically because it is in the scene; check this once.
4. **Check (browser):** paint 3 strokes, Undo twice (the ground goes back stroke by stroke), reopen Brick Lab (the ground persists), switch world and back, and repeat with wifi off (offline). Also check that a piece placed after a stroke undoes in the right order.
5. `check.mjs` green. Commit `feat(brick-lab): undo and save painted ground`.

**DONE WHEN:** one stroke is one Undo step; the ground persists per world across reloads and offline; old worlds and old history snapshots don't break.

---

## Slice 05: ground in shared worlds

**Files:** `js/brick-lab/brick-share.js` (`PROTO`), `js/brick-lab/brick-together.js` and `scripts/brick-together.test.mjs`.

**Depends on:** 04, and brick-lab-multiplayer shipped (it has).

1. `PROTO` 7 → 8, adding to the history comment `8: painted ground (terrain-painter D8)`. Mismatched peers are already refused in `hello` (line 121), which covers old-tablet safety.
2. **Welcome:** add `ground: this.lab.groundBox.cells` to the `welcome` head (4096 chars), and raise the head reserve from `LINE_MAX − 4096` to `LINE_MAX − 8192`. Guest `guestWorld`: `this.lab.groundBox.cells = cleanGround(message.ground)`, then `createClient({ world, seq, ground: this.lab.groundBox })`, then `this.lab.setGround(...)`. A resync goes through the same path.
3. **Request / apply:** `together.request(op)` already forwards any op, and the host sequencer checks it with `rules.ground`. Guest `apply` returns an inverse, which goes on that kid's `together.undo`, so shared undo works per kid with no new code. Check in a test.
4. **Size:** an L stroke across the whole plate could touch all 4096 cells. The JSON is about 4096 × 5 + 4096 ≈ 25 KB, under the 64 KB line. Assert this in a test with a worst-case op. If that is ever too big, split the stroke into ≤ 1024-cell ops grouped with `together.undo.group(n)` as at line 4679.
5. **Guests keep no copy:** the guest's ground box is never saved. Check that `saveNow` is already skipped for guests (grep the guest save guard) and that it also covers ground.
6. **Busy walkers:** ground ops are not blocked by `claims.busy`. Make that explicit: `busy(op)` returns false for `type === "ground"`.
7. **Tests** (`brick-together.test.mjs`, which already fakes two peers): host paints and the guest sees it; guest paints and the host and second guest see it; both paint the same cell and the last seq wins on all three; guest undo restores only their own stroke; a PROTO 7 peer is refused; a worst-case op fits one line.
8. **Browser:** the pretend-wifi harness used by brick-lab-multiplayer slice 06; paint from both sides.
9. **Real tablets:** run `ACCEPT-ANDROID-LAN.cmd` on two tablets. Add a ground step to its checklist if it is scripted (otherwise do it by hand), and record the result in this file's build notes.
10. `check.mjs` green. Commit `feat(brick-lab): share painted ground (PROTO 8)`.

**DONE WHEN:** strokes show on every tablet in a shared world, last one wins, per-kid undo works, old PROTO peers are refused, and it has been run on two real tablets.

---

## Cross-slice checks (run after each slice)
- `node scripts/check.mjs` green: syntax, bilingual, tests, no secrets.
- The 中文 uses Taiwan wording (地面, 橡皮擦, 石板路, 岩漿).
- Placement, stacking, rails, assemblies, poses and walking behave exactly as before. Ground is paint only (D3); `landing()` and `brick-parts.js` are untouched.
- No stars, no network calls outside the existing LAN, and it works with wifi off.
- No file deleted.

## Risks
- **Painted-stud overlay on the cheap tier** (slice 02 step 3): if it costs frames, use the flat fallback and write the choice down in the build notes.
- **Instance colours on WebGL1 r162:** `instanceColor` is supported, but check it on the legacy path before slice 03.
- **History shape change** (slice 04): grep all `history` readers before changing them.

## Build notes
(Fill in as slices ship: date, commit, what was checked, deviations.)
