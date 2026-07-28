# Slice 41 - Giraffe mini-book

**Goal:** Add a small standalone giraffe book, following the same hardened Books reader pattern already used by the existing collection.

**Status:** done (2026-07-28)

**Depends on:** Slices 36 through 40.

**Do not implement:** quizzes, rewards, audio narration, Supabase sync, a new layout, or a shared runtime.

---

## Scope

Create one focused mini-book about giraffes for kid reading time. This should feel like the existing Books feature, not a new app.

Use:

- standalone `books/giraffe.html`
- data file `js/books/giraffe-data.js`
- local image folder `assets/books/giraffe/`
- bilingual EN + Traditional Chinese copy
- offline precache in `sw.js`
- optional shelf entry in `index.html`

The existing Animals book already has a `giraffe` card. Reuse it as the starting point, then expand it into a short sequence.

---

## Reader Shape

Copy the current book shell pattern:

- open-book layout
- left page: title, type badge, 3 bilingual facts
- right page: local photo with overlay
- previous/next controls
- grid/all-pages view
- zoom on photo tap
- swipe and keyboard navigation

Only change topic-specific values:

- title: `Giraffe · 長頸鹿`
- data global: `GIRAFFE_CARDS`
- accent color
- group chips if useful

---

## Content Plan

Target 8 to 10 cards. Keep each fact short enough for the left page.

| Card | Angle |
|---|---|
| `giraffe` | Basic introduction: tallest animal, long neck, spots |
| `neck` | Seven neck bones, same count as humans |
| `spots` | Every pattern is unique |
| `tongue` | Long dark tongue for reaching leaves |
| `food` | Acacia leaves and careful browsing |
| `legs` | Long legs, fast walking and running |
| `baby` | Calves can stand soon after birth |
| `sleep` | Very short sleep compared with many animals |
| `habitat` | African savannas and open woodlands |
| `family` | Giraffes live in loose groups called towers |

Tone:

- curious and gentle
- real biology
- no scary predator framing
- no conservation doom language on kid pages

---

## Data Requirements

Every card must include:

```js
{
  id: "spots",
  emoji: "🦒",
  nameEN: "Giraffe Spots",
  nameZH: "長頸鹿斑點",
  photo: "../assets/books/giraffe/spots.jpg",
  typeEN: "GIRAFFE FACT",
  typeZH: "長頸鹿知識",
  group: "body",
  facts: [
    { en: "Every giraffe has a unique spot pattern.", tz: "每隻長頸鹿都有獨一無二的斑點圖案。" },
    { en: "The spots help giraffes blend into trees and shade.", tz: "斑點幫助長頸鹿融入樹木和陰影中。" },
    { en: "Scientists can use spots to tell giraffes apart.", tz: "科學家可以用斑點分辨不同的長頸鹿。" },
  ]
}
```

Facts stay exactly 3 bilingual pairs per card.

---

## Images

Create:

- `assets/books/giraffe/README.md`
- `assets/books/giraffe/giraffe.jpg`
- `assets/books/giraffe/neck.jpg`
- `assets/books/giraffe/spots.jpg`
- `assets/books/giraffe/tongue.jpg`
- `assets/books/giraffe/food.jpg`
- `assets/books/giraffe/legs.jpg`
- `assets/books/giraffe/baby.jpg`
- `assets/books/giraffe/sleep.jpg`
- `assets/books/giraffe/habitat.jpg`
- `assets/books/giraffe/family.jpg`

Preferred sources:

- Wikimedia Commons
- public-domain zoo or wildlife agency images
- compatible CC images with credits recorded in README

Resize to about 640px wide, JPG quality around 80.

---

## Integration

After the mini-book is complete:

1. Add `books/giraffe.html`.
2. Add `js/books/giraffe-data.js`.
3. Add all local images and credits.
4. Add the book shell, data file, and images to `sw.js`.
5. Bump `CACHE_NAME`.
6. Add a Books shelf card if Papa wants it visible as its own book:

```js
{
  id: "giraffe",
  icon: "🦒",
  titleEN: "Giraffe",
  titleZH: "長頸鹿",
  blurbEN: "Necks, spots, calves, and savanna life",
  blurbZH: "脖子、斑點、小長頸鹿和草原生活",
  file: "books/giraffe.html",
  ready: true
}
```

If the shelf should stay at six books, keep this hidden and link it later from Animals.

---

## Acceptance Checks

- `books/giraffe.html` opens directly.
- Shelf card opens it only after `ready:true`.
- All visible kid copy is bilingual.
- Every card has exactly 3 EN + Traditional Chinese facts.
- All photos are local files.
- Grid/all-pages view works.
- Zoom works.
- Swipe and arrow keys work.
- Offline reload works after service worker install.
- `node scripts/check.mjs` passes.

