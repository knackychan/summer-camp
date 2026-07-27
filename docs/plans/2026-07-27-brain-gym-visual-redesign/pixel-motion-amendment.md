# Amendment — pixel-art motion, fixed sprite scale and juice policy

**Date:** 2026-07-27
**Status:** proposal for Papa's review — not approved; implementation MUST NOT start until approved
**Amends:** `implementation-guidelines.md` §§6.3, 8, 12.9 and `visual-ui-agent-prompt.md` "Pixel geometry"
**Amends nothing else.** Product rules, palette, bilingual copy, game logic, state machine, accessibility, offline caching, performance budgets and tests stand unchanged.

## 1. Why this exists

The redesign keeps soft modern pixel art *and* wants game-feel motion. Those are compatible — modern pixel games do exactly this — but only under rules the current documents do not yet fix:

- pixel sprites shimmer under sub-pixel movement;
- `whenever layout permits` in the sprite-geometry rules permits fractional scaling, which is what makes pixel art look cheap;
- the best pixel-game juice lives in **frames and timing**, not in CSS `scale`, and the art deliverables do not currently ask for it.

This document fixes those three gaps so the visual agent has one normative source.

## 2. Decisions requiring approval

| # | Decision |
|---|---|
| A1 | Sprite display scale `S` is a fixed integer per breakpoint. Fluid sprite scaling is removed. |
| A2 | Sprite motion snaps to whole CSS pixels; travel, shake and overshoot use multiples of `S`. |
| A3 | Squash, stretch and rotation are **baked as frames**, never produced with CSS `scale`/`rotate` on a sprite. |
| A4 | Three additions to the motion service: `snap`, `frames()`, `hitstop()`. No other contract changes. |
| A5 | Hit-stop, palette flash and integer screen shake join the approved juice set, with fixed parameters and a denylist. |
| A6 | Incorrect answers get a shake, but on the **answer object**, not the screen. Screen-level shake stays a success/impact device. Colour is hint-amber, never red. |
| A7 | Frame-strip art is required only for shared UI and the Change Maker pilot in slices 34–35. The other eight scenes inherit the strips proven by the pilot. |

## 3. Fixed sprite scale (amends §6.3, and the "whenever layout permits" rule)

`S` is the integer multiplier applied to a sprite's **native** pixel dimensions.

| Breakpoint | `S` | 64-native object renders at |
|---|---|---|
| Compact — width < 600 px | 2 | 128 px |
| Tablet — 600–1100 px | 3 | 192 px |
| Wide — > 1100 px | 3 | 192 px |
| Short landscape — height < 650 px | 2 | 128 px |

Rules:

- `S` MUST be an integer. Fractional scale MUST NOT be used at any breakpoint.
- Short landscape overrides the width-based value.
- Wide deliberately reuses the tablet value: §6.3 already caps content at 1000 px and asks for outer breathing room rather than larger tasks.
- Layout flexes **around** fixed sprite sizes. A sprite MUST NOT be sized with `width: 100%`, `vw`/`vh` units, or a percentage of its container.
- `S` MUST be published as `--brain-px` on the Brain shell and read by scenes as `motion.snap`. A scene MUST NOT hardcode a pixel multiplier.
- The `image-rendering: pixelated` requirement is unchanged.

Interactive sprites remain subject to the existing touch-target floor: the **hit area is a DOM element of at least 64 CSS px** regardless of `S`. A small sprite gets a larger transparent hit area, never a larger sprite.

## 4. Snap rules (amends §8)

Two separate concerns; do not conflate them.

**4.1 Shimmer avoidance — MUST**

Every sprite's resolved on-screen position MUST be a whole CSS pixel. In practice: transform values must round to integers before being applied, and layout positions must not introduce fractional offsets (centering with `translate(-50%,-50%)` on an odd-width element is the usual culprit — use explicit even dimensions or integer offsets).

Non-integer device-pixel ratios (1.5, 2.625) cannot be fully aligned and are accepted as-is. Do not contort layout to chase them.

**4.2 Pixel-motion feel — SHOULD**

Travel distance, shake amplitude and easing overshoot SHOULD resolve to multiples of `S`. This is what makes motion read as deliberate rather than as a smoothly-tweened photograph of pixel art.

`--brain-ease-settle: cubic-bezier(.34,1.35,.64,1)` is retained. Its overshoot distance SHOULD be an integer multiple of `S`.

**4.3 Travel budget**

Long eased travel at high zoom is the one case where snapping looks jerky and not-snapping looks mushy. Keep sprite travel short:

- object arrivals and coin-to-tray arcs: fine;
- full-width slides of a sprite: replace with an exit/entrance pair per §8.2's existing 180 ms / 320 ms question transition.

## 5. Motion service delta (amends §12.9)

The four existing helpers are unchanged. Add three:

```js
motion.snap                      // integer S for the current breakpoint
motion.frames(element, strip, {  // frame-strip playback
  fps,                           // 8–16; frames advance on whole steps only
  loop,                          // default false
  hold                           // 'first' | 'last', default 'last'
})
motion.hitstop(ms)               // scheduler-owned global freeze, 60–100 ms
```

- `move()` gains an internal round-to-whole-CSS-pixel on the resolved transform.
- `frames()` and `hitstop()` MUST delegate to the round scheduler per §12.9's existing rule; neither may create a timer. `hitstop` therefore pauses and resumes correctly on `visibilitychange` and is cancelled by `cancelAll()`.
- `hitstop` occurs inside feedback, which §12.7's active-answer clock already excludes. It MUST NOT be used while input is enabled.
- Tests still assert `activeCount === 0` after destroy; `frames()` and `hitstop()` are covered by that assertion.

## 6. Approved juice (extends §8.2)

| Move | Parameters | Where |
|---|---|---|
| **Hit-stop** | 60–100 ms total freeze before the reaction plays | Correct answer, and the till-drawer impact in Change Maker |
| **Frame-swap squash / anticipation** | 2–3 frames, 8–16 fps | Token press, object landing |
| **Palette flash** | 1–2 frames (~80 ms) in the success or scene accent ramp | Correct answer only |
| **Integer screen shake** | 3 steps, amplitude 1–2 × `S`, ≤ 120 ms, on the scene container | Success impact only |
| **Object nudge** | 2 decaying cycles, amplitude 2 × `S`, horizontal only, 220 ms, on the answer object | Incorrect answer |
| **Pixel particles** | existing cap: 12 particles, ≤ 640 ms | Unchanged from §8.2 |

### 6.1 The incorrect-answer cue

An error needs a cue; it must not read as a reprimand. The rule that separates the two is **scope**, not amplitude:

- the shake moves the **answer object** — the change tray, the chosen operator tile, the tapped floor button — never the scene container, header or backdrop;
- it is horizontal only and decays; a rising or high-frequency buzz-shake is forbidden;
- it is slower than the success shake (220 ms vs ≤120 ms). Fast reads as alarm, slow reads as "not yet";
- accompanying colour is `hint` (`#D99416`). Red MUST NOT appear;
- audio is a soft descending two-note figure. No buzzer, no error klaxon;
- the shake carries no information, so it never replaces the counting highlight and correct-total reveal that already teach the answer.

Total corrective feedback stays within §8.2's 900 ms: 220 ms nudge, then the readable explanation.

Cheaper alternatives if the nudge tests badly on tablet, in preference order: hint-amber outline pulse (identical to the reduced-motion fallback, so it is already specified); a frame-strip "settle back" returning the piece to its slot; audio-only with the counting highlight.

Existing §8.2 limits still bind: one focal animation at a time, ambient motion stops within 300 ms of the scene becoming answerable, the prompt/equation/Stroop word/recall target stay still while input is enabled, correct feedback stays within 420–640 ms **including hit-stop**.

## 7. Denylist

- CSS `scale` or non-uniform scale on a sprite — it resizes the pixels. Bake frames.
- CSS `rotate` at arbitrary angles on a sprite. Rotation is 90° steps or a baked strip; a coin flip is a 4-frame strip, not a `rotateY`.
- Palette flash in red, anywhere, ever.
- **Scene-container** shake on an incorrect answer. Shaking the whole world at a child who got a sum wrong is the punitive reading the coach-not-cop rule exists to prevent. The object-scoped nudge in §6.1 is the approved form.
- Fast, high-frequency or rising-pitch shake on error — same reason.
- Blur, drop-shadow, brightness and contrast filters on sprites — already forbidden by the sprite rules and restated here because "palette flash" invites `filter: brightness()`. Flash is a baked frame.
- CRT filters, scanlines and chromatic aberration — already forbidden, unchanged.

## 8. Reduced motion delta (amends §8.3)

Add two lines to the existing list:

- hit-stop duration becomes 0;
- screen shake is removed, replaced by the existing 160 ms outline emphasis;
- the §6.1 object nudge is removed, replaced by the same 160 ms outline emphasis in `hint`. The counting highlight and correct-total reveal are unaffected — the informative part of corrective feedback never depends on motion.

Frame strips MAY still play if they carry meaning (a drawer opening), but decorative squash strips hold on their first frame. Timers, study durations and input behavior remain unchanged.

## 9. Art deliverable delta (amends `visual-ui-agent-prompt.md` §5)

Per A7, frame strips are required now only for:

**Shared UI**
- button face: idle → pressed, 2 frames;
- stamp: neutral, success, hint — success gets a 3-frame land;
- one success flash frame per interactive sprite family.

**Change Maker pilot**
- coin/note: idle, 2-frame press, 4-frame flip;
- till drawer: open and close strips;
- receipt: print/tear strip.

The remaining eight scenes reuse whatever strip vocabulary survives the pilot's tablet review. Do not author strips for them in slices 34–35.

The existing strip authoring rules are unchanged: equal frame sizes in one horizontal strip, fixed registration point, stable bounding box, clean hold on first and last frames.

## 10. Verification

Add to the visual test matrix (§15.2/15.3):

- one screenshot per breakpoint confirming sprites render at exactly `S ×` native size;
- a reduced-motion screenshot confirming no shake and no hit-stop;
- the existing `activeCount === 0` teardown assertion covers the new helpers.

`node scripts/check.mjs` needs no change; nothing here touches data or bilingual copy.

## 11. Unchanged

Scene adapter contract (§12.4), host state machine (§12.5), grading (§12.6), active-answer clock (§12.7), scheduler contract (§12.8), audio service (§12.10), palette (§4), typography (§5), composition (§6.1–6.2, 6.4), components (§7), input and accessibility (§10), bilingual rules (§11), fallback (§13), offline (§14). Slices 34–37 remain valid as written; this amendment changes tokens, art deliverables and three helper signatures, not architecture.
