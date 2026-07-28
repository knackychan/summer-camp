# Slice 40 — Complete Books collection

**Goal:** Add the remaining five standalone books using the hardened Space reader pattern, with local images, bilingual facts, credits, precache, and check coverage.

**Design reference:** `docs/plans/2026-07-28-books/design-reference.md`

**Depends on:** Slices 36 through 39.

**Do not implement:** admin authoring, search, rewards, quizzes, Supabase sync, or a new frontend framework.

---

## Books to ship

| Order | File | Data | Asset folder | Target cards |
|---:|---|---|---|---:|
| 1 | `books/animals.html` | `js/books/animals-data.js` | `assets/books/animals/` | ~40 |
| 2 | `books/science.html` | `js/books/science-data.js` | `assets/books/science/` | ~20 |
| 3 | `books/race-cars.html` | `js/books/race-cars-data.js` | `assets/books/race-cars/` | ~15 |
| 4 | `books/construction.html` | `js/books/construction-data.js` | `assets/books/construction/` | ~20 |
| 5 | `books/public-vehicles.html` | `js/books/public-vehicles-data.js` | `assets/books/public-vehicles/` | ~15 |

Ship one topic at a time. Do not mark a shelf book `ready:true` until its file, data, images, credits, and precache all pass.

---

## Required per-book workflow

For each book:

1. Create or verify `assets/books/<topic>/`.
2. Create `assets/books/<topic>/README.md`.
3. Gather local images from Wikimedia Commons, NASA, manufacturer/media pages with compatible use, or other acceptable public/credited sources.
4. Resize images to <= 640px wide where practical.
5. Create `js/books/<topic>-data.js`.
6. Copy the hardened Space reader shell to `books/<topic>.html`.
7. Change only the pinned topic-specific values.
8. Add shell/data/images to `sw.js`.
9. Mark that one shelf entry `ready:true`.
10. Run `node scripts/check.mjs`.
11. Manually open the new book and test navigation.

Do not batch all five books in one risky edit.

---

## Data requirements

Every card:

- `id`
- `emoji`
- `nameEN`
- `nameZH`
- `photo`
- `typeEN`
- `typeZH`
- `facts`: exactly 3 bilingual fact pairs

Recommended optional fields:

- `group`
- `fit`
- `source`

All facts must be short enough for the left page. If a fact needs a semicolon, it is probably too long.

---

## Topic content guidance

### Animals

Target groups:

| group | Examples |
|---|---|
| `mammals` | Elephant, tiger, dolphin, bat |
| `birds` | Eagle, penguin, owl |
| `reptiles` | Turtle, crocodile, chameleon |
| `insects` | Butterfly, bee, ant |
| `ocean` | Octopus, shark, seahorse |

Tone:

- Real-world biology.
- No scary framing.
- Avoid predator gore.

### Science

Target groups:

| group | Examples |
|---|---|
| `matter` | Solid, liquid, gas |
| `forces` | Gravity, magnets, friction |
| `energy` | Light, sound, electricity |
| `earth` | Volcano, cloud, rainbow |
| `body` | Heart, lungs, brain |

Tone:

- Everyday cause-and-effect.
- Use simple experiments only if safe and parent-neutral.
- Avoid instructions that require heat, chemicals, or tools.

### Race Cars

Target groups:

| group | Examples |
|---|---|
| `race-types` | Formula car, rally car, kart |
| `parts` | Tire, wing, engine, brakes |
| `tracks` | Pit stop, starting grid |
| `safety` | Helmet, roll cage |

Tone:

- Machines and engineering.
- No speed worship without safety context.
- No brand claims unless sourced.

### Construction

Target groups:

| group | Examples |
|---|---|
| `earthmoving` | Excavator, bulldozer, loader |
| `lifting` | Crane, forklift |
| `building` | Cement mixer, dump truck |
| `tools` | Concrete, scaffolding |

Tone:

- What each machine does.
- Safety-positive.
- No "play on construction sites" framing.

### Public Vehicles

Target groups:

| group | Examples |
|---|---|
| `emergency` | Ambulance, fire truck, police car |
| `transit` | Bus, train, tram |
| `service` | Garbage truck, mail truck |
| `city` | Street sweeper, tow truck |

Tone:

- Community helpers.
- Calm emergency wording.
- No frightening disaster detail.

---

## HTML shell rules

Each book HTML:

- Complete HTML document.
- Inline CSS/JS.
- No external runtime dependency.
- Loads its own data file with a classic script tag.
- Uses the same reader regions as Space.
- Uses the same control labels.
- Uses topic title in English and Chinese.

Only topic-specific changes allowed:

| Field | Example |
|---|---|
| Title | `Animals · 動物` |
| Data global | `ANIMALS_CARDS` |
| Accent variable | `--book-accent` |
| Category chips | Topic-specific groups from data |

Do not invent a different reader layout per book.

---

## Shelf readiness rules

After a book passes checks:

- Set `ready:true`.
- Keep `file`.
- Render CTA as `Read now · 開始閱讀`.

Before it passes:

- Keep `ready:false`.
- Do not open it.
- Keep `Coming soon · 即將推出`.

---

## Service worker rules

For each ready book, add:

- `./books/<topic>.html`
- `./js/books/<topic>-data.js`
- Every `./assets/books/<topic>/*.jpg`
- The topic README is optional for runtime, but may be precached if existing pattern keeps READMEs cached.

Bump `CACHE_NAME` after changing `APP_SHELL`.

---

## Acceptance checks per book

- Book opens standalone.
- Book opens from shelf after marked ready.
- All controls are bilingual.
- Every card has an image or emoji fallback.
- Every card has 3 bilingual facts.
- Grid/all-pages view works.
- Category chips work if present.
- Zoom works.
- Offline reload works after cache install.
- Credits README exists and names sources.
- `node scripts/check.mjs` passes.

---

## Final collection acceptance

- All six shelf cards are `ready:true`.
- No coming-soon cards remain.
- All six books open.
- All six data files pass validation.
- All ready book shells/data/images are precached.
- No book makes a runtime network request.
- No book depends on `index.html` app state.
- The Books tab still appears between Learn and Ask.
- `node scripts/check.mjs` passes.

---

## Out of scope

- Book search.
- Favorite cards.
- Reading progress.
- Audio narration.
- Papa content editor.
- Automatic scraping scripts.
- Image generation.

