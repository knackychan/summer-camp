# Brick Lab — assemblies (wall / floor / tower / bridge) and a Favourites category

**Status:** approved by Papa, 2026-10-06 (chat: pasted "Brick Lab: Draggable Assemblies & Favorites Refactor" → favourites "One category: ★ then recents" → assembly "Presets + steppers" → cap "64 blocks" → entry "First tile in Bricks / Plates / Tiles only" → place flow "Menu card + drag like a part" → sync "one atomic batch op" → "ok go").

**Amends:** `docs/plans/2026-10-03-brick-lab/11-parts-browser.md` (favourites and recents were pinned sections above every category; they become one category) and `12-rail-parts-browser.md` D23 (the category list gains one tile). `docs/plans/2026-10-04-brick-lab-multiplayer/` — one new op type, `PROTO` 6, still ordered by the host tablet's code.

## How the pasted brief was adapted
| Brief said | Here | Why |
|---|---|---|
| A floating favourites bar at the top clutters the view | There is no floating bar. Favourites (★) and recents (last 5) were pinned sections at the top of the parts grid inside the rail, above *every* category. They move into one category. | The clutter is real, but it lives in the rail grid. |
| "No manual starring" | The ☆ toggle stays; the category lists starred parts first, then recents. | Papa chose "★ then recents": a kid keeps a starred brick forever, recents fill the rest. |
| Recents top 8–12 | 12 | Fits the two-column grid in six rows. |
| Floor 32×32 = 64 plates | Steppers count *blocks*, not studs; count capped at 64. A 2×2-plate floor tops out at 8×8 blocks = 16×16 studs. | 32×32 studs of 2×2 plates is 256 plates. |
| `AssemblyBuilder` class, `selectedColor` global | A pure generator function in `brick-assembly.js`; colour is the rail's picked colour at placement | Node-testable like `brick-walk.js`; keeps `brick-lab.js` from growing. |
| "Assembly in every category's first item" | First tile of Bricks, Plates and Tiles only | Tiling makes no sense for minifigs, animals, trees, doors. |
| Custom user-defined pattern | Dropped | Papa chose presets + steppers. |
| Sync "all blocks" | One atomic `batch` op | Nothing half-built if another tablet changes the plate mid-send. |

## Decisions
| # | Decision | Rationale |
|---|---|---|
| A1 | **Favourites ⭐ 最愛 is one category.** A new tile at the top of the category list. Inside: starred parts first, then recents (up to 12, newest first, a part that is also starred is shown once, in the starred group). The ☆ toggle on every tile and the info-card star are unchanged. The pinned ★ / 🕘 sections are removed from every other category and from search results. Empty: "Parts you use show up here 用過的積木會出現在這裡". Saved prefs keep their shape (`favorites`, `recents`); only `RECENT_MAX` goes 5 → 12. | Every category gets its full grid back; nothing a kid starred is lost. |
| A2 | **An Assembly tile is the first tile of Bricks, Plates and Tiles** (and nowhere else). It is a normal-sized tile with a pattern icon and the label "Build a wall 一次蓋牆". Tapping it arms the assembly using the part last armed in that category (or the category's first part) and opens the menu card. It does not appear in Favourites or in search results. | Matches the brief's "first item"; only parts that tile get it. |
| A3 | **Four presets, steppers count blocks.** All sizes are in blocks of the armed part: *along* (its long side), *across*, *up* (layers). Wall = along × 1 × up. Floor = along × across × 1. Tower = along × across × up, solid. Bridge = a deck of along × across blocks at the top, resting on two end pillars (one block column wide, across wide) of up − 1 layers each. Defaults: Wall 8×1×3, Floor 4×4×1, Tower 2×2×8, Bridge 6×1×3. A stud size ("32 × 2 studs") and a live count ("24 bricks 塊") show beside the steppers. Counts clamp: ≤ 64 blocks and inside the island; the stepper that would pass the cap does nothing. The kid can also turn it ↻ 90°. | No remainder maths: every size is a whole number of blocks. |
| A4 | **The menu is an overlay card, not part of the rail.** It sits over the bottom-left of the view like the part info card (D9: never resizes the 3D canvas; the rail stays 184 px). Controls: four pattern icons, − / + steppers for along / across / up (≥ 56 px, `pointerdown`), ↻, the armed block tile (tap to swap for another part of Bricks / Plates / Tiles), the count. Pre-readers get icons only, no text. Last settings per pattern are remembered per kid in prefs (`assembly`). | One place for the controls; the ghost shows the result, so no confirm step. |
| A5 | **Place it like a part, one drag or one tap.** The ghost wall follows the finger through the existing `ghostAt()` path (including slice 15's drag from the rail; dragging from the card's preview works the same). Snap and stacking are the usual rules applied to the assembly as one rigid shape: its base sits at the highest landing under any bottom-layer block. Letting go, or tapping the plate, places every block. The assembly stays armed for repeat placement. A spot where any block would leave the plate or overlap something shows no ghost and does nothing — never red, never a warning (coach, not cop). | One placement path for parts and assemblies. |
| A6 | **One atomic `batch` op, `PROTO` 6.** `{ type: "batch", ops: [add…] }`, 1–64 `add` members (or 1–64 `remove` members: the inverse). The host checks every member (`checkOp` rules, no duplicate ids inside the batch) and applies all or none; one `apply` message is broadcast. The inverse is one `batch` of `remove`s with each member's `expect`, so Undo is a single step — in together mode through the existing `createUndo().push` (one entry, no `group()` needed), solo through one history snapshot. Saved worlds are unchanged: the pieces are ordinary pieces. A guest on `PROTO` 5 is refused by the existing hello check. | No half-built wall; the host's code still orders every change. |
| A7 | **Ghost is one merged preview, drawn only when it changes.** The preview is built once per (pattern, sizes, part, rotation) as one merged mesh (the same colour slots as a single part) and moved, not rebuilt, while the finger moves. Frames follow D25 (on demand). The reduced quality tier draws it as the footprint outline box. | Low-end tablets (D26) must not drop frames dragging 64 blocks. |
| A8 | **Not in this plan:** a free footprint painter, copy & stamp, rails in the bridge (Rails join by their own rules), hollow towers, assemblies of non-tiling parts, per-block colours. | Papa's scope. |

## Kid-facing strings (EN + 繁體中文)
| Where | EN | 繁體中文 |
|---|---|---|
| Category | Favourites | 最愛 |
| Empty favourites | Parts you use show up here | 用過的積木會出現在這裡 |
| Assembly tile | Build a wall | 一次蓋牆 |
| Patterns | Wall · Floor · Tower · Bridge | 牆 · 地板 · 塔 · 橋 |
| Steppers | Long · Wide · Tall | 長 · 寬 · 高 |
| Count | 24 bricks | 24 塊 |
| Drag hint | Let go where it should go | 拖到想放的地方再放手 |

## Slices
| Slice | What | Depends on |
|---|---|---|
| [01](01-favourites-category.md) | Favourites ⭐ category, recents 12, pinned sections removed | brick-lab 12 |
| [02](02-assembly-generator-and-batch-op.md) | `brick-assembly.js` generator + `batch` op in `brick-share.js`, `PROTO` 6 (pure, node-tested, nothing wired) | — |
| [03](03-assembly-menu-and-placement.md) | Assembly tile, menu card, ghost, placement, Undo, together | 01 (category list), 02, brick-lab 15 |

Slices 01 and 02 ship independently. Slice 03 is the only one that edits the render path.
