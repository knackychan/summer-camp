# Brain Gym sprite provenance

Every pixel-art sprite in `assets/brain/sprites/` is original art generated for Summer Quest through
the connected Magnific MCP and post-processed in this repository. No commercial-game art, stock pack,
photograph or real banknote design is used anywhere in the pack.

This file is the required provenance log: for each sprite it records the exact prompt, the generation
parameters, the post-processing command, and why a candidate was accepted or rejected. No credentials,
tokens or account identifiers are recorded here.

**Status: Change Maker only.** The pixel treatment was approved on the first three assets, so the
Corner Shop set was finished: the till, four coin bases, two note bases and the product. The other
eight scenes are still not generated.

## Pipeline

Magnific returns an opaque ~1024 px "pixel-art look" image, not a native-grid sprite with alpha. Two
repository scripts turn that into a production sprite:

| Step | Tool | What it does |
|---|---|---|
| 1 | Magnific `images_generate` | render the object on a flat `#FF00FF` chroma key |
| 2 | `scripts/pixelize.ps1` | chroma-key the backdrop, auto-crop, box-average onto the native grid, hard alpha threshold, snap to the approved palette, despeckle |
| 3 | `scripts/pack-atlas.ps1` | pack native sprites into per-scene atlases and emit `sprites/manifest.json` |

Notes on deliberate choices:

- **A magenta key, not `images_remove_background`.** AI background removal returns a feathered alpha
  edge. §2 of the brief forbids gradients baked into the alpha edge, and pixel art needs a hard
  1-bit-style cutout. Chroma-keying during downsampling gives exactly that, and costs no extra credits.
- **Palette snapping, not the model's colours.** The model approximates the requested palette. Snapping
  every kept pixel to the declared ramp is what guarantees the 6–10 colour budget and the dark-plum
  outline `#3B3159` instead of a near-black outline.
- **Generated contact shadows are discarded.** They arrive as soft transparency over the backdrop.
  Guidelines §3.2 requires short opaque offsets, so contact shadows are authored in CSS.
- Sources are kept: native sprites in `sprites/src/`, atlases in `sprites/`.

## Shared prompt template

```text
Create one original 2D pixel-art game sprite for a children's educational game, on a flat solid pure magenta #FF00FF background.

Object: [OBJECT]
Scene: [SCENE]
Purpose/state: [IDLE / PRESSED / OPEN / SUCCESS / CORRECTIVE / ANIMATION FRAME]
Native canvas: [64x64 / 96x96 / 128x128] pixel art grid, large chunky pixels clearly visible
View: front-facing with a very shallow 2.5D top view, maximum 12-degree implied depth
Lighting: soft upper-left light
Outline: crisp 1-2 pixel dark-plum outline, colour #3B3159, never black
Palette: strictly limited to about [N] colours - [RAMP]
Style: friendly modern 16-bit / 32-bit-inspired pixel art, rounded educational-toy proportions, clean pixel clusters, restrained highlights
Background: flat solid pure magenta #FF00FF, completely uniform, no gradient, no shadow cast on the background
Edges: hard aliased pixel edges, no antialiasing, no blur, no painterly texture, no soft gradient
Exclude: text, numbers, letters, logo, watermark, photorealism, 3D render, glossy plastic, neon, casino imagery, CRT scanlines, dithering noise
Output: one isolated production-ready sprite centered in frame with generous empty magenta padding around it
```

The template in `visual-ui-agent-prompt.md` §4 asks for a transparent background. That is replaced by
the magenta key for the reason above; every other field is used verbatim.

For strips, the addendum is:

```text
Create [N] equally sized frames in one horizontal sprite strip, arranged left to right in a single row.
Registration: the object stays in exactly the same position and the same size in every frame; only [MOVING PART] moves. The bounding box does not shift.
Background: ... no dividing lines between frames, no borders
Exclude: ... frame numbers, labels, arrows, motion lines
```

---

## `apple` — 64 × 64, 1 frame

- **Provenance id:** `apple-idle`
- **Scene:** Change Maker (Corner Shop). Reused by Calculations (Fruit Stand) and Word Memory (Library Desk).
- **Model:** Google Nano Banana 2 (`imagen-nano-banana-2-flash`)
- **Parameters:** aspect 1:1, resolution 1k, count 2, no references, no brand kit
- **Ramp:** `#3B3159` outline, `#F2685C` / `#D8453E` / `#9E2C33` fruit red, `#3E9E63` leaf, `#8A6A34` stem, `#FFF5DC` highlight — 7 colours
- **Post:** `powershell -File scripts/pixelize.ps1 -In apple-a.png -Out assets/brain/sprites/src/apple.png -Size 64 -Palette "#3B3159,#F2685C,#D8453E,#9E2C33,#3E9E63,#8A6A34,#FFF5DC"`

Prompt (object/scene fields only; the rest is the shared template):

```text
Object: a single red apple with one small green leaf and a short brown stem
Scene: corner shop / fruit stand produce
Purpose/state: IDLE
Native canvas: 64x64
Palette: paper #FFF5DC, paper-2 #F1E3BF, ink #2F2845, outline #3B3159, plus a warm red apple ramp
  (#F2685C highlight, #D8453E mid, #9E2C33 shade) and a leaf green (#3E9E63)
Exclude: ... multiple objects
```

- **Variant A — accepted.** Leaf and stem read as two separate clusters at 64 px, the highlight sits
  upper-left, the silhouette stays round and legible at 1×.
- **Variant B — rejected.** Stem and leaf merge into one cluster once downsampled, so the fruit reads
  as having a single dark growth on top.

## `till` — 256 × 256, 3 frames

- **Provenance id:** `till-open-strip`
- **Scene:** Change Maker (Corner Shop)
- **Model:** Google Nano Banana 2 (`imagen-nano-banana-2-flash`)
- **Parameters:** aspect 21:9, resolution 2k, count 2. 21:9 because the tool rejects 3:1 and 4:1; the
  three frames are recovered by `-Frames 3`.
- **Ramp:** `#3B3159` outline, `#2F2845` ink, `#5CC98C` / `#2F9E68` / `#1E6B47` register green derived
  from `--brain-change`, `#FFF5DC` / `#F1E3BF` paper, `#D9B27E` / `#B4844A` drawer — 9 colours
- **Post:** `powershell -File scripts/pixelize.ps1 -In till-b.png -Out assets/brain/sprites/src/till-strip.png -Size 256 -Frames 3 -AlignFrames -Palette "#3B3159,#2F2845,#5CC98C,#2F9E68,#1E6B47,#FFF5DC,#F1E3BF,#D9B27E,#B4844A"`

```text
Object: ONE single toy cash register machine, seen straight on. It is one connected object: a chunky
  rounded green register body on top with a blank cream display panel and a row of four round cream
  buttons, and directly below it, built into the same body, a wide money drawer with a cream front
  panel and a small round handle.
Animation: the drawer sliding open toward the viewer, out of the machine body.
Frame 1 drawer fully closed, frame 2 half open, frame 3 fully open showing SIX empty rounded
  compartment wells, all the same size, evenly spaced, completely empty.
Registration: the green register body stays in EXACTLY the same position and the same size in all
  three frames. Only the drawer slides downward.
The wells are empty holes with nothing inside them, because coins will be drawn on top of them later.
  The display panel is completely blank for the same reason.
Native canvas: each frame is a 256x256 pixel art grid
Exclude: ... coins, banknotes, money inside the wells, hands, people
```

- **Variant B — accepted.** Its drawer holds a 2 × 4 well grid, which fits four coins on one row and
  two notes on the other. That covers both the `mid` tier (4 denominations) and `hard` (6).
- **Variant A — rejected.** Five wells in a single row cannot hold six denominations, and no CSS
  layout rescues art that has the wrong number of slots.
- **Replaces the earlier `register` and `drawer` sprites.** Two separate objects could never share one
  open/close animation, and Papa asked for a machine that reads as one interactable thing. The two
  superseded source PNGs stay in `sprites/src/` — nothing is deleted — but they are no longer packed.
- **Regions measured from the sprite, recorded in the manifest:** `display` at 52,33 (94 × 24) and
  `drawer` at 22,163 (152 × 52). The scene positions DOM layers from those numbers; no scene code
  guesses at pixel offsets.
- **Residual limitation.** The drawer opening is 52 native px deep. Two rows of tokens at 1× need
  about 70 native px, so on the six-denomination tier the bottom row sits proud of the drawer front.
  Deepening the drawer means regenerating this strip.

## `coin` — 64 × 64, 4 frames (NT$1, NT$5, NT$10, NT$50)

- **Provenance id:** `coin-strip`
- **Scene:** Change Maker (Corner Shop)
- **Model:** Google Nano Banana 2 (`imagen-nano-banana-2-flash`)
- **Parameters:** aspect 21:9, resolution 1k, count 2
- **Ramp:** `#3B3159` outline, `#2F2845` ink, `#E6E4EC` / `#C3C0CE` / `#8E8AA0` silver,
  `#F2CE72` / `#D6A63C` / `#9E7420` gold — 8 colours
- **Post:** `powershell -File scripts/pixelize.ps1 -In coins-a.png -Out assets/brain/sprites/src/coin-strip.png -Size 64 -Frames 4 -InsetX 10 -InsetY 130 -Pad 3 -Palette "#3B3159,#2F2845,#E6E4EC,#C3C0CE,#8E8AA0,#F2CE72,#D6A63C,#9E7420"`

```text
Object: four stylized round toy learning coins, seen perfectly face-on from directly above. They are
  blank play tokens, NOT real currency.
Cell 1 smallest, cool silver, plain smooth rim. Cell 2 slightly larger, cool silver, notched milled
  rim. Cell 3 larger, cool silver, double ring rim, wide flat blank centre. Cell 4 largest, warm
  gold-brass, notched milled rim, wide flat blank centre.
Every coin face is completely EMPTY and flat in the middle - a smooth blank disc with no design, no
  numerals, no letters, no portrait, no emblem, no engraving of any kind. The centre must stay clear
  because a number will be drawn on top of it later.
View: perfectly flat face-on circle, no perspective, no tilt, no thickness shown
Exclude: ... currency symbols, dollar signs, portraits, faces, emblems, stars, real coin design,
  glossy metal reflection, casino chips, stacks of coins
```

- **Variant A — accepted.** Its four cells are equal widths, so equal-width frame splitting cuts the
  set correctly, and the diameter progression is clean at 64 px.
- **Variant B — rejected.** Better-looking coins, but the generated cells were unequal widths; the
  frame split would have clipped the set.
- **Correction applied.** Variant A arrived with divider lines drawn on the cell edges and a box
  border. `-InsetX 10 -InsetY 130` ignores that margin during measuring and sampling, which removes
  the lines without retouching pixels.
- Rising diameter plus silver→gold is a deliberate non-colour cue: the denominations stay
  distinguishable without reading the DOM numeral.

## `note` — 128 × 128, 2 frames (NT$100, NT$500)

- **Provenance id:** `note-strip`
- **Scene:** Change Maker (Corner Shop)
- **Model:** Google Nano Banana 2 (`imagen-nano-banana-2-flash`)
- **Parameters:** aspect 2:1 requested, snapped by the tool to 16:9; resolution 1k, count 2
- **Ramp:** `#3B3159` outline, `#2F2845` ink, `#FFF5DC` / `#F1E3BF` paper,
  `#E9A0A4` / `#CF6870` / `#9C3F4C` rose, `#D9B27E` / `#B4844A` / `#7E5A2E` brown — 10 colours
- **Post:** `powershell -File scripts/pixelize.ps1 -In notes-a.png -Out assets/brain/sprites/src/note-strip.png -Size 128 -Frames 2 -Palette "#3B3159,#2F2845,#FFF5DC,#F1E3BF,#E9A0A4,#CF6870,#9C3F4C,#D9B27E,#B4844A,#7E5A2E"`

```text
Object: two stylized rectangular toy learning banknotes, seen perfectly face-on. They are blank play
  money for a maths game, NOT real currency.
Cell 1 a rose-red note. Cell 2 a warm brown note.
Each note is a wide rounded rectangle, about twice as wide as it is tall, with a simple decorative
  border of small repeated squares just inside the edge, and a large completely BLANK rounded panel
  filling the middle. The blank middle panel must stay clear and flat because a number will be drawn
  on top of it later.
Exclude: ... serial numbers, portraits, faces, buildings, emblems, seals, signatures, guilloche
  security patterns, real banknote design, folded or fanned notes, stacks of money
```

- **Accepted on the first variant.** The blank centre panel is exactly the DOM text area the design
  requires, and the dotted border reads as play money rather than a document.
- Guidelines §3.4 is satisfied literally: broad note form and distinct colour carry the identity, and
  no portrait, serial number or security design is reproduced. These are learning tokens, not currency.
- The note occupies the middle band of its 128² canvas, so a note renders 128 × ~65 CSS px at 1× —
  above the 96 × 52 minimum in §7.3.

---

## Rejected across the whole pilot

| What | Verdict | Reason |
|---|---|---|
| `images_remove_background` for alpha | not used | feathered alpha edge; the brief forbids gradients baked into the alpha edge |
| Generated contact shadows | discarded | soft transparency over the backdrop; §3.2 requires short opaque offsets |
| Whole-screen "shop scene" generation | not attempted | §3 forbids flattening a screen into one image; only reusable objects are generated |
| Any baked numeral, `NT$`, or label | excluded in every prompt | all task-critical text stays DOM/SVG |
