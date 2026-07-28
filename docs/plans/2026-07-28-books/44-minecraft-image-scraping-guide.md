# Minecraft Image Scraping Guide

**Goal:** gather relevant Minecraft images for the four-page evolution book using the `scrapling` command tool, then vendor them locally with clear source notes.

**Applies to:**

- `42-minecraft-evolution-book.md`
- `43-minecraft-four-block-layout.md`
- future `assets/books/minecraft/` image set

---

## Core Rules

1. **Use images as evidence, not decoration.** Pick images that match the spread's subject: early Minecraft, the Nether, Caves & Cliffs, Tricky Trials, Chaos Cubed, and so on.
2. **Prefer official Minecraft.net update images for game-update history.** They match the subject and usually include strong in-game screenshots or key art.
3. **Do not hotlink at runtime.** Scrape/discover online, then download and store local copies in `assets/books/minecraft/`.
4. **Record every source.** Add each image to `assets/books/minecraft/README.md` with source page, original image URL, download date, and usage note.
5. **Avoid noisy page chrome.** Skip logos, icons, social buttons, store badges, ESRB images, divider backgrounds, and tiny navigation thumbnails.
6. **Be license-aware.** Official Minecraft images are suitable for internal planning/mockups and Minecraft-related context, but do not assume they are freely licensed for redistribution. For a public/offline shipped book, confirm usage rights or use licensed/CC alternatives.
7. **Keep images inspectable.** Use real in-game screenshots or official key art where the update feature is visible. Avoid images that are too dark, cropped, blurred, or mostly text.

---

## Recommended Folder Shape

```text
summer-quest/
+-- assets/books/minecraft/
|   +-- README.md
|   +-- 2009-cave-game.jpg
|   +-- 2010-nether.jpg
|   +-- 2011-release.jpg
|   +-- 2018-aquatic.jpg
|   +-- 2020-nether-update.jpg
|   +-- 2021-caves-cliffs.jpg
|   +-- 2023-trails-tales.jpg
|   +-- 2024-tricky-trials.jpg
|   +-- 2025-chase-skies.jpg
|   +-- 2026-chaos-cubed.jpg
+-- docs/plans/2026-07-28-books/
    +-- minecraft-*.scrap.md
    +-- 44-minecraft-image-scraping-guide.md
```

Use short, chronological filenames. They are easier to map back to spreads than generic names like `image1.jpg`.

---

## Scrapling Workflow

### 1. Scrape the source page to Markdown

Use Markdown output first because it exposes image alt text and image URLs clearly.

```powershell
scrapling extract get --ai-targeted `
  "https://www.minecraft.net/en-us/updates/minecraft-updates-timeline-and-evolution" `
  "summer-quest\docs\plans\2026-07-28-books\minecraft-official-timeline.scrap.md"
```

For a specific update article:

```powershell
scrapling extract get --ai-targeted `
  "https://www.minecraft.net/en-us/article/minecraft-java-edition-26-2" `
  "summer-quest\docs\plans\2026-07-28-books\minecraft-java-26-2.scrap.md"
```

If the sandbox blocks the network request, rerun the same command with approval through Codex. Do not work around the approval system.

### 2. Find candidate image lines

```powershell
rg -n "!\[|Click .*full|content/dam|\.jpg|\.png|\.webp" `
  "summer-quest\docs\plans\2026-07-28-books\minecraft-java-26-2.scrap.md"
```

Good candidates usually look like:

```md
![One big and one small Sulfur Cube standing inside a huge underground Sulfur Cave Biome...]
(/content/dam/minecraftnet/article-asset/2026/minecraft-26-2/new-article-hero-image.jpg)
```

Or:

```md
[Click here for a link to the full-size image.]
(https://www.minecraft.net/content/dam/minecraftnet/article-asset/2026/minecraft-26-2/26.2_1_original.png)
```

### 3. Convert relative image URLs to absolute URLs

Minecraft.net pages often use relative image paths:

```text
/content/dam/minecraftnet/article-asset/2026/minecraft-26-2/new-article-hero-image.jpg
```

Make them absolute before downloading:

```text
https://www.minecraft.net/content/dam/minecraftnet/article-asset/2026/minecraft-26-2/new-article-hero-image.jpg
```

### 4. Download the selected image

Scrapling is for discovering and extracting the page. Use PowerShell to download the actual binary image after you choose it.

```powershell
New-Item -ItemType Directory -Force -Path "summer-quest\assets\books\minecraft"

Invoke-WebRequest `
  -Uri "https://www.minecraft.net/content/dam/minecraftnet/article-asset/2026/minecraft-26-2/new-article-hero-image.jpg" `
  -OutFile "summer-quest\assets\books\minecraft\2026-chaos-cubed.jpg" `
  -Headers @{ "User-Agent" = "Mozilla/5.0" }
```

If an image download returns `403`, retry with a browser-like User-Agent. If it still fails, choose another source or use the official full-size link if the article provides one.

### 5. Resize and normalize

Target:

- Width: `800-960px` for the Minecraft four-page book.
- Format: JPG for screenshots/key art, PNG only when transparency or text clarity matters.
- Quality: around `80`.
- Keep subject visible after crop.

If ImageMagick is available:

```powershell
magick "summer-quest\assets\books\minecraft\2026-chaos-cubed.jpg" `
  -resize 960x960\> `
  -quality 80 `
  "summer-quest\assets\books\minecraft\2026-chaos-cubed.jpg"
```

Use `object-fit: contain` later for images with UI text, mobs, or feature diagrams. Use `cover` for broad landscape/key-art images.

---

## Source Page Shortlist

Use official pages first:

| Subject | Source Page | Image Intent |
|---|---|---|
| Whole timeline | `https://www.minecraft.net/en-us/updates/minecraft-updates-timeline-and-evolution` | timeline key art, update carousel images |
| Chaos Cubed | `https://www.minecraft.net/en-us/article/minecraft-java-edition-26-2` | sulfur cube, sulfur caves, physics examples |
| Tiny Takeover | `https://www.minecraft.net/en-us/article/play-the-tiny-takeover-drop` | baby mobs, golden dandelion |
| Mounts of Mayhem | `https://www.minecraft.net/en-us/article/play-mounts-of-mayhem-today` | spears, nautilus mounts, mounted combat |
| Chase the Skies | `https://www.minecraft.net/en-us/article/chase-the-skies-and-vibrant-visuals-playable-today` | happy ghast, flight, Vibrant Visuals |
| The Copper Age | `https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-9` | copper golem, copper equipment, shelves |
| A Minecraft Movie | `https://www.minecraft-movie.com/home/` | only if the spread discusses media expansion |
| Microsoft acquisition | `https://news.microsoft.com/source/2014/09/15/minecraft-to-join-microsoft/` | use sparingly; likely not visually rich |

For early history, official screenshots may be harder to license or locate. Use one of these safer approaches:

- Official Minecraft 15th anniversary pages or Xbox Wire retrospectives.
- Minecraft Wiki pages only as research, not as a default image source.
- Publicly licensed Wikimedia images if they are about Minecraft culture, events, or displays.
- A generated or custom block-style illustration if no clearly usable historical screenshot is available.

---

## Image Selection Map For The Four-Page Book

One image per spread is enough. Some spreads can use no image if the text breathes better.

| Spreads | Best Image Type | Notes |
|---|---|---|
| 01-03: origin and Cave Game | early-style block world, anniversary image, or custom generated block prototype scene | avoid unlicensed old screenshots unless source rights are clear |
| 04-05: survival and creeper | creeper/key art or night survival screenshot | pick something readable, not too dark |
| 06-07: Indev/Infdev/crafting/world generation | crafting table, cave, horizon, terrain screenshot | a broad landscape works well |
| 08-09: Alpha, Mojang, Nether | Nether portal or Nether biome image | official Nether Update images can represent the concept if early images are unavailable |
| 10-12: Beta, 1.0, 2012-2013 | Ender Dragon, village, redstone, horse, biome image | choose one image that matches the strongest paragraph |
| 13: Microsoft and Bountiful | ocean monument, armor stand, banner, or command/mapmaking screenshot | business page images are less useful |
| 14-15: combat, education, color, cross-play | elytra, classroom, colorful blocks, cross-platform key art | do not overuse logos |
| 16: oceans, villages, bees, Nether | aquatic, village, bees, or Nether image | pick the most visually exciting update in the spread |
| 17: Caves & Cliffs | mountains, large cave, axolotl, goat, copper | strong candidate for a full-width feature image |
| 18: Wild Update | mangrove swamp, ancient city, Warden, allay | balance scary and kid-appropriate |
| 19: Trails & Tales | cherry grove, archaeology, camel, sniffer, armor trims | cherry grove is likely the warmest image |
| 20-21: game drops and 2024 | Tricky Trials, crafter, mace, pale garden, Creaking | use official update timeline images |
| 22: 2025 | happy ghast, copper golem, mounted combat | choose one per spread or rotate if the reader supports thumbnails |
| 23: 2026 | sulfur cube and sulfur caves | latest-release anchor image |
| 24-25: outside the game and closing | classroom, community build, movie still/key art, or montage | only use movie art if the spread discusses the movie |

---

## Credit README Template

Create:

```text
summer-quest/assets/books/minecraft/README.md
```

Use this table:

```md
# Minecraft Book Images

Images vendored for the Minecraft evolution book. Do not hotlink at runtime.

| File | Spread | Source Page | Original Image URL | Source / Rights Note | Download Date | Notes |
|---|---|---|---|---|---|---|
| `2026-chaos-cubed.jpg` | 23 | https://www.minecraft.net/en-us/article/minecraft-java-edition-26-2 | https://www.minecraft.net/content/dam/.../new-article-hero-image.jpg | Official Minecraft update image; verify usage before public redistribution. | 2026-07-28 | Sulfur cube and sulfur cave hero image. |
```

Never leave an image without a source row.

---

## Quality Checklist

Before accepting an image:

- The image clearly matches the spread's subject.
- The main subject is visible at tablet size.
- It is not just a logo, button, divider, or store badge.
- It has a recorded source page and direct image URL.
- It is stored locally under `assets/books/minecraft/`.
- The filename describes year and subject.
- It has been resized to a reasonable width.
- It will still make sense next to bilingual text.
- It does not add a runtime network dependency.

---

## Common Mistakes

- **Scraping everything from a page.** Better: scrape the page, inspect candidates, download only the strongest images.
- **Using decorative divider images.** Minecraft.net pages include many background dividers; skip them.
- **Forgetting relative URLs.** `/content/dam/...` must become `https://www.minecraft.net/content/dam/...`.
- **Using movie imagery for game-update history.** Use movie images only for the media-expansion spread.
- **No credits README.** This breaks the Books feature pattern and makes future cleanup painful.
- **Too many images.** The four-page layout needs rhythm. One strong image per spread is usually better than four tiny pictures.
