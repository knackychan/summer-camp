# Slice 03 — World parts: minifigures, animals, hats, theme props

**Requested by Papa, 2026-10-05** ("some animals, accessories, Lego-figurine … tree, vehicle, housing, castle, sci-fi scene, pirates"). Implements design.md C4, C6.

**Depends on:** 01.

## Parts (all EN + 中文, ids stable)
- **Nature** (+15): round tree, tall pine, palm tree, apple tree, bush, mushroom, rock, cactus, grass, sunflower, log, pumpkin, pond, campfire, tent. New plants stack on plates; the old tree and flower still plant into the baseplate.
- **Minifigures 小人偶** (new, 16): minifigure, minifigure with ponytail, sitting minifigure (rides horses, sits on chairs, seats, thrones), knight, king, princess, wizard, pirate captain (peg leg), pirate, astronaut, robot, alien, firefighter, police officer, chef, farmer. The shirt (and most trousers) take the palette colour; faces stay minifig yellow.
- **Animals 動物** (new, 20, their own colours): dog, cat, horse and unicorn (ridable), cow, pig, sheep, chicken, duck, rabbit, frog, fish, shark, parrot, crocodile, dragon (takes the palette colour, ridable), turtle, owl, monkey, penguin.
- **Hats & Hair 帽子 · 頭髮** (new, 11): crown, knight helmet, viking helmet, pirate hat, wizard hat, cap, cowboy hat, hard hat, space helmet, ponytail hair, long hair. 2×1 like a minifig; they drop over a head (C5).
- **Home & Town 居家 · 城鎮** (new, 16): table, chair, bed, sofa, floor lamp, bookshelf, TV, stove, fridge, toilet, bathtub, potted plant, mailbox, park bench, street lamp, traffic light.
- **Castle 城堡** (new, 10): battlement, portcullis, banner, torch, weapon rack, shield, throne, sword in the stone, catapult, well.
- **Pirates 海盜** (new, 11): treasure chest, barrel, crate, cannon, anchor, ship's wheel, mast & sail, pirate flag, gold coins, life ring, treasure map.
- **Space 太空** (new, 12): radar dish, antenna, control console, energy crystal, solar panel, teleporter pad, moon base dome, rocket, flying saucer, alien plant, fuel tank, satellite.

**DONE WHEN:** as slice 01, a seeded scene shows a rider on a horse with a helmet, a figure on a chair and a crew on a ship's deck at the right heights.

**Verified 2026-10-05:** `check.mjs` green (after `npm run build:mobile` and `npm run build:android-web`, which a fresh container lacks); `check-brick-lab-ui.py` 95/95 on source (Chromium 141 headless, SwiftShader) with the slice-14 "slow standard tablet steps down" check skipped — it fails the same way on the untouched code in this container (SwiftShader frame timing); the reduced tier still draws 88 calls / 31,490 triangles, the same as before. Every category reviewed in rendered contact sheets and a seeded scene. Not yet run: `check-android8-ui.py` with Chrome 138 (no Chrome 138 binary in the container), and real touch on a tablet.
