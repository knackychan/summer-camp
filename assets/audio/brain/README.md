# Brain Gym sound effects — cue table and provenance

**Status: no audio files exist yet.** This directory currently holds only this table. Nothing here
claims a sound was produced. Brain Gym still plays the prototype oscillator beeps in
`js/brain-ui.js` and in `design-preview.html`.

Why nothing is recorded yet:

- The shared Web Audio service (`js/game-services/audio.js`) lands in slice 34, which is not
  implemented. Until it exists there is no mute source of truth, no unlock-on-gesture path and no
  `stopAll()` for a cue to route through, and `implementation-guidelines.md` §10 forbids a scene
  calling `Audio` directly.
- No sound-generation tool is connected to this workspace. The Magnific MCP does image, video, 3D,
  speech and music — not short wooden-toy percussion effects. Producing these cues therefore needs
  either original recording/synthesis by Papa or a redistribution-cleared pack Papa approves first
  (slice 35: "No external asset download is accepted without Papa approving its license and
  repository provenance first").

## Approved cue list

These are the only cues scenes may use. A scene MUST reuse one before requesting a new one.

| Cue | Used by | Visible equivalent (required — every sound has one) |
|---|---|---|
| `ui-tap` | every scene | button press state: translate down 3 px, shadow removed |
| `token-pick` | change, calc, wordmem | token lifts out of its home slot |
| `token-place` | change, calc | token lands in the tray/basket, tray total updates |
| `paper-slide` | wordmem, recall, corrective feedback | card or parcel slides; corrective panel fades in |
| `drawer-open` | change | drawer sprite steps frames 0 → 2 |
| `drawer-close` | change | drawer sprite steps frames 2 → 0 |
| `coin-1` | change | NT$1 token arcs to the tray |
| `coin-5` | change | NT$5 token arcs to the tray |
| `coin-10` | change | NT$10 token arcs to the tray |
| `coin-50` | change | NT$50 token arcs to the tray |
| `note-place` | change | NT$100 / NT$500 note slides into the tray |
| `stamp` | change, calc | order/receipt stamp lands |
| `lift-ding` | lowhigh | lift lamp lights, doors close |
| `train-arrive` | clock | train enters the platform |
| `brush-swish` | stroop | one clean brush sweep across the canvas |
| `scanner-tick` | crunch | scanner highlight advances one step |
| `success` | host | success stamp + progress pip turns to a check |
| `round-complete` | host | result panel enters |

## Rules any future recording must satisfy

- Original, or documented redistribution permission recorded in this file (source, author, licence,
  URL, date).
- Mono, 32 kHz, MP3. One runtime format only — do not mix formats in v1.
- Individual effect under 35 KB; whole pack under 350 KB.
- Wooden-toy percussion palette: soft clicks, paper, wood, coins, a small bell, a short
  marimba-like success motif.
- No harsh error buzzer, no casino cash-register reward sound, no arcade jingle.
- Corrective feedback uses `paper-slide` or silence — never a negative buzz.
- Coin repeats vary pitch deterministically within ±3%; question generation stays deterministic.
- Maximum four simultaneous effects. Success is quieter than speech.
- Precached in `APP_SHELL`; no CDN, no runtime fetch outside same-origin cached assets.
- Mute, backgrounding and `destroy` stop every active sound.

## Provenance log

| File | Cue | Source | Author | Licence | Export | Date |
|---|---|---|---|---|---|---|
| _(none yet)_ | | | | | | |
