# Brick Lab — Build Together (multiplayer over the home wifi)

**Status:** approved by Papa, 2026-10-04 (chat: pasted "Brick Lab Multiplayer Layer" brief → "i would go for option A personnaly for the Server" (a tablet hosts) → all tablets run the APK → several worlds per kid, opening a world hosts it automatically, guests keep no copy → anyone can change any brick → "yes" on the three design sections → "yes i approve, add this to the plan and go", with the real-shape part icons added as slice 08).

**Supersedes, from the pasted brief:** the Supabase `worlds` / `world_peers` / `brick_state` tables and RLS, Supabase as the server, public worlds and "Explore Recent", 8-character world codes, "world persists after host leaves", a 4-player cap, and the generic "framework for Origami, Kitchen, Code Quest" (the transport stays game-neutral, but only Brick Lab uses it). The brief is not kept in the repo; this file is the record.

**Amends:** `docs/plans/2026-10-03-brick-lab/design.md` D6 (local save only) — see D8 below.

## What it is
A kid opens one of their Brick Lab worlds and, without doing anything else, it is open on the home wifi. A sibling on another tablet sees "🧱 Maya · Castle 城堡" in their Join list, taps it and builds in the same world. Every change is saved on the host's tablet. When the host closes the world, the visit ends. Internet is not needed — only the home wifi.

## Decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | **A tablet is the server.** The host tablet runs a small TCP server inside our own Capacitor plugin (`SummerQuestNativePlugin`, native overlay) and announces it with Android NSD (mDNS, service type `_sqbricks._tcp`). Guests find it with NSD and connect through the same plugin. Messages are newline-delimited JSON. No new Java dependency, no Supabase. | Papa's choice. Works with the internet down (offline-first), costs nothing on the Supabase free tier, and only devices on the home wifi can ever see a world — no strangers, no codes to vet. A browser page can't host and can't open `ws://` from an https origin, so the plugin owns both ends. |
| D2 | **APK only.** Every kid tablet runs the Android APK (Papa, 2026-10-04). Where the plugin is missing (browser, desktop, tests) Brick Lab runs solo exactly as today and the Join area reads "Building together needs the Summer Quest app · 一起蓋需要 Summer Quest 應用程式". | One code path for multiplayer; the web build never breaks. |
| D3 | **Several worlds per kid**, saved on the kid's tablet. Menu first: "My worlds 我的世界" (cards with a small picture of the world, name, brick count), "+ New world 新世界", and "Join 加入" (worlds open nearby). The existing single build becomes the kid's first world — nothing lost. | Papa's choice. The picture on each card is what pre-readers (≤ 5) go by (brick-lab D5). |
| D4 | **Opening a world hosts it automatically.** No "Host" button, no approval: any sibling can join at any time while it's open. Leaving the world (Back to the menu, closing Brick Lab, leaving the app) ends the session. | Papa's choice. Nothing to set up for a 5-year-old. |
| D5 | **The host tablet keeps order — automatically.** This is plumbing, not a permission step: the host *kid* never sees or confirms anything. The host tablet's code holds the real world. A guest tablet never changes its own copy directly: it sends a request (add / move / remove / recolour); the host tablet's code checks it, applies it, saves, numbers it (`seq`) and sends it to everyone — the asker included — in a few milliseconds. Joining sends the whole world first, then the changes. Two kids touching the same brick can't clash: the host applies in order and the later request simply loses. | No conflict logic, no CRDT. Three kids on one wifi need nothing more. |
| D6 | **Anyone can change any brick.** Each brick remembers who placed it (`by`), shown as a small tint in that kid's colour while in a shared world. Undo in a shared world reverses only the kid's *own* last change; if someone has changed that brick since, nothing happens and the hint reads "Someone changed that · 有人改過了". Solo undo stays the existing snapshot undo. **Changed while building slice 05 (2026-10-04):** the tint changed the brick's colour on screen (a red brick looked pink, a green plate brown — against D12's "exactly the colour picked"), so instead the selection outline takes the placer's colour and the hint says "Lili put this one here. · 這塊是 Lili 放的。"; bricks keep their own colour. | Papa's choice (collaborative, not protective). Snapshot undo would wipe the siblings' work. |
| D7 | **Guests keep no copy.** Every change lands in the host's saved world only. A guest's own worlds are never touched while visiting; Back returns the guest to their own menu. Delete, rename and "clear all" are world operations: host only, from the menu, never during a session. | Papa's choice. One owner per world, no merge. |
| D8 | **Brick-lab D6 amended:** "Solo builds stay on the tablet. Shared worlds travel over the home wifi only and are saved on the host's tablet only. Still no Supabase, still no stars." | Never delete a decision — amend it. |
| D9 | **Gentle failure, never red.** Host gone → guests see "Maya's world closed · Maya 的世界關閉了" and return to their menu. Guest drops off wifi → "Looking for Maya's world… 正在找 Maya 的世界…", retries ~30 s, rejoin = fresh copy; requests the host never got are dropped (the host is the truth). Nobody nearby → "No worlds open nearby · 附近沒有開著的世界". Different app versions → "Update the app on both tablets · 兩台平板都要更新" and the connection is refused cleanly (protocol version in `hello`). While guests are connected the host keeps its screen awake. | Coach, not cop. A sleeping host tablet would freeze everyone. |
| D10 | **The host tablet's code checks every request** (automatic, no kid involved): part id and colour from the catalog, position inside the plate, rail rules from `brick-rails.js`, message size ≤ 64 KB, one connection per kid id. | Any device on the wifi can open a socket, even at home. |
| D11 | **Locks:** Brick Lab is a creative tool (brick-lab D4) — Games lock and Brain Gym gate don't apply. A Papa app pause (slice 08 of homework-lock) on a guest makes it leave; on the host it closes the world for everyone (D9 wording). | Existing rules, nothing new. |
| D12 | **Part icons are the real part** (Papa, 2026-10-04: "it would be better if it look exactly like the shape you are going to choose with the color picked"). Each tray tile shows a small picture rendered from the same `makePieceMesh()` the plate uses, in the colour currently picked, from a fixed ¾ view. Rendered with Brick Lab's existing renderer into an offscreen target (no second WebGL context), cached per `part:colour`, a few per frame, only for tiles on screen. The CSS-drawn icons stay as the fallback (WebGL lost, first frame). | The CSS shapes are approximations; the kid should pick exactly what lands on the plate. One GL context matters on Android 8 / Adreno 3xx tablets. Independent of multiplayer — can ship first. |

## Protocol (D1, D5)
One JSON object per line. `proto` is a single integer, bumped on any incompatible change.

| Direction | Message |
|---|---|
| guest → host | `{"t":"hello","proto":1,"kid":"maya","app":"<build id>"}` |
| host → guest | `{"t":"welcome","world":{…same payload as the saved world…},"seq":42,"peers":["leo","maya"]}` or `{"t":"refuse","why":"proto"}` |
| guest → host | `{"t":"req","id":"<req id>","op":{…}}` |
| host → all | `{"t":"apply","seq":43,"by":"maya","req":"<req id>","op":{…}}` |
| host → asker | `{"t":"reject","req":"<req id>"}` |
| host → all | `{"t":"peers","peers":[…]}` |
| either | `{"t":"bye"}` |

Ops: `add {piece}`, `move {id, x, y, z, rotation}` (rotate is a move), `remove {id}`, `recolor {id, colorId}`. Undo sends the inverse op with an `expect` field (the state the kid left the brick in); the host rejects it if the brick no longer matches. The host's own changes go through the same loop in-process, so host and guests behave the same.

## Pieces
| Piece | Job |
|---|---|
| Native plugin (overlay `SummerQuestNativePlugin.java`) | `lanHost(name, txt)`, `lanStop()`, `lanDiscover()` / `lanStopDiscover()`, `lanJoin(host, port)`, `lanSend(peer, line)`, `lanLeave()`, `keepAwake(on)`; events `lanFound`, `lanLost`, `lanPeerOpen`, `lanLine`, `lanPeerClosed`. Knows nothing about bricks. |
| `js/game-services/lan-session.js` | Thin JS wrapper; `isAvailable()`; a loopback fake for tests; clean "not available" without the plugin. |
| `js/brick-lab/brick-worlds.js` | Several worlds per kid in `localStorage`; migration of `sq:brick-lab:v1:<kid>`. |
| `js/brick-lab/brick-share.js` | Pure: op schema, checks, apply, inverse ops, host sequencer, guest client. No DOM, no Three — Node-testable. |
| `js/brick-lab/brick-thumbs.js` | Part icon renderer + cache (D12). |
| Brick Lab menu (in `brick-lab.js` + `css/brick-lab.css`) | My worlds / New / Join; presence chips; toasts. EN + 中文. |

## Not in this plan
Other kids' cursors or held bricks; typing an IP by hand (only if the home router turns out to block discovery); playing outside the home wifi; a player cap; sharing worlds through Supabase; multiplayer for other games.

## Slices
- `01-worlds.md` — D3, D7 (menu part), D8
- `02-share-model.md` — D5, D6, D10 (pure logic)
- `03-native-lan.md` — D1, D9 (keep awake)
- `04-lan-session.md` — D2
- `05-host-join.md` — D4, D5, D6 (live)
- `06-when-things-go-wrong.md` — D9, D11
- `07-device-acceptance.md` — all, on real tablets
- `08-real-part-icons.md` — D12 (independent; may ship first)

**Amended 2026-10-05 (found on the real tablets, slice 07):** the 64 KB line cap of D10 stays, but the host's welcome no longer has to fit in one line. A world past about 600 bricks is sent as the welcome plus `world` lines (`more` in the welcome), and the guest loads it once they are all in. `PROTO` is 2; a tablet on the older APK gets the "update" line instead of half a world.
