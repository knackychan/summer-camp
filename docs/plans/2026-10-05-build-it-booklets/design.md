# Build It! 來蓋吧! — brick instruction booklets for real bricks at home

**Status:** DRAFT, waiting for Papa's approval. Written 2026-10-05 from the chat: "it would be more to help them build their own LEGO outside of the brick lab, in real life using their own lego bricks they have at home. so an instruction booklet to help them build many different lego things". Nothing here is built until Papa says go.

## What this is
A new book on the Books shelf. Each model is a step-by-step instruction booklet, like the paper one in a box, that the kids follow with **their own bricks on the table**. It is not a Brick Lab game. The steps are drawn in 3D with Brick Lab's real part shapes, so a kid can turn the model with a finger to see where a brick goes. Everything is inside Summer Quest and works with the wifi off.

## Decisions
| # | Decision | Rationale |
|---|---|---|
| B1 | **Our own models only.** Every booklet is an original design (a rocket, a duck, a house, a robot…). We never copy a LEGO set, a LEGO manual or a licensed character, and we never scrape a manual site. Kid-facing text says "bricks 積木", not the brand name. | Official manuals are LEGO's copyright. Our own designs can live in git, in the APK and on the web build without any problem, and we can make as many as we like. |
| B2 | **A book on the Books shelf**: "Build It! 來蓋吧!" 🧱, a new entry in `BOOK_SHELF` with a `layout: "steps"`. It uses the shelf's existing back button, page counter, ◀ ▶ and "All Pages" grid. | Papa wants it outside Brick Lab, as a book; the book reader already has the navigation the kids know. |
| B3 | **A model is data**: name EN + 中文, a level, a short intro and a list of steps. Each step adds pieces in Brick Lab's own piece shape `{ partId, colorId, x, y, z, rotation }` and may carry a tip EN + 中文. Data lives in `js/books/build-it-data.js`, one object per model. | The same shape Brick Lab saves, so the part names, sizes and colours already exist in EN + 中文 (`brick-catalog.js`, `brick-parts.js`), and a model could later open in Brick Lab. |
| B4 | **Small steps.** At most 4 new pieces per step on Easy, 6 on Medium and Big. The first page of every model is **"What you need 你需要"**: every piece with its count, worked out from the steps (never typed by hand). | A paper manual's rhythm; small steps are what makes a 5-year-old succeed. A list worked out from the steps can't disagree with them. |
| B5 | **The step page**: the model so far in 3D, with this step's new pieces at full colour and a soft glow, and the earlier pieces slightly faded. A callout box shows this step's pieces as part icons with "2×". One finger turns the model; ⌂ snaps back to the step's best view. A ▼ arrow drops each new piece into place when the page opens (none with `prefers-reduced-motion`). | It reads like a real instruction page, but can be turned around, which paper can't. |
| B6 | **Colours are a suggestion.** Every model page says "Any colour works! 什麼顏色都可以!". The callout names the shape first ("Brick 2×4 積木 2×4") and shows the colour as a swatch. | A family brick box is a mix; a kid who has no red 2×4 shouldn't be stuck. |
| B7 | **Levels, not stars**: 🧱 Easy 簡單 (≤ 20 pieces), 🧱🧱 Medium 中等 (≤ 50), 🧱🧱🧱 Big 大作品 (≤ 120). Each model is tagged with any special parts it needs (wheels 輪子, slopes 斜面, round 圓形), and the shelf can show "Only basic bricks 只用基本積木". | Kids pick something they can finish with what's in their box. Stars stay the ledger's (no stars here). |
| B8 | **Per kid, local**: the app remembers each kid's step in each model and an "I built it! 我蓋好了!" tick, the way the other books keep their place. **No stars, no timer, no lock.** | Coach, not cop. A finished model is its own reward. |
| B9 | **Shared part shapes**: Brick Lab's part-drawing functions (`make*Piece` in `js/brick-lab/brick-lab.js`) move unchanged into `js/brick-lab/brick-meshes.js`; Brick Lab and the booklet both import them. This is a pure move: Brick Lab's behaviour and look stay exactly the same, proved by its existing browser checks. Three comes from `js/games/three-runtime.js` (WebGL2, r162 on WebGL1). | One look for every part in the app, and no second copy of 238 part shapes to keep in step. The move is the only change to Brick Lab. |
| B10 | **Every model is checked by the computer** (`node scripts/check.mjs`): each piece's part and colour exist; no two pieces overlap; every piece sits on studs of a piece below it or on the ground (no floating bricks); each step respects B4; levels respect B7; every name and tip has EN + 中文. A script renders every step to a picture sheet for Papa to look at before a model ships. | Models are written as data, not drawn by hand, so a computer has to prove they can really be built. Papa's eye checks that they look good. |
| B11 | **Offline**: the book's data and code are in the service worker list and the APK like the other books. No network, no PDFs. | Offline-first. |

## Kid-facing strings (EN + 中文)
- Book: ["Build It!", "來蓋吧!"] · blurb ["Build real models with your own bricks", "用你自己的積木蓋出真的模型"]
- ["What you need", "你需要"] · ["Step", "第 … 步"] · ["Any colour works!", "什麼顏色都可以!"] · ["I built it!", "我蓋好了!"] · ["Turn it around", "轉轉看"]
- Levels ["Easy", "簡單"] ["Medium", "中等"] ["Big", "大作品"] · tags ["wheels", "輪子"] ["slopes", "斜面"] ["round", "圓形"] · ["Only basic bricks", "只用基本積木"]

## First models (wave 1, all original)
Easy: Little Rocket 小火箭 · Duck 小鴨 · Snail 蝸牛 · Flower Pot 盆栽
Medium: Little House 小房子 · Robot 機器人 · Race Car 賽車 (wheels) · Bus 公車 (wheels)
More waves later (Lighthouse 燈塔, Dragon 小龍, Fire Station 消防局…), each reviewed on a picture sheet first.

## Open question for Papa
What is in the kids' box? Mostly basic bricks and plates, or also slopes, round bricks and wheels? Wave 1 assumes mostly bricks and plates, a few slopes and round pieces, and puts wheels only in the two vehicles.

## Not in this plan
Copying real sets or manuals; PDFs; photos of the kids' builds; stars or rewards; making a booklet automatically from a Brick Lab world (a good later plan); opening a model in Brick Lab.

## Slices
- `01-shared-meshes.md` — B9: move the part-drawing functions to `brick-meshes.js` (no change to Brick Lab)
- `02-model-format-and-checks.md` — B3, B4, B7, B10: the data format, the checker, the parts list, the first model (Little Rocket)
- `03-step-reader.md` — B2, B5, B6, B8, B11: the book on the shelf and the 3D step pages
- `04-wave-1-models.md` — the other 7 models and the picture sheet for Papa
- `05-device-checks.md` — Android 8 / Chrome 138 check and a build on the tablets
