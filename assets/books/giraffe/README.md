# Giraffe Book — Image Scrape List

## Status: SCRAPED (2026-07-28)

Images sourced from Wikimedia Commons via `scripts/scrape_book_images.py`.

## Image specifications
- Format: JPG
- Max width: 640px
- Quality: ~80%
- Source: Wikimedia Commons CC BY-SA / public domain

## Files

| File | Search terms |
|---|---|
| giraffe.jpg | giraffe standing portrait |
| neck.jpg | giraffe zoo tall |
| spots.jpg | giraffe fur spot pattern |
| tongue.jpg | giraffe tongue black eating |
| food.jpg | giraffe eating acacia tree |
| legs.jpg | tall giraffe walking |
| baby.jpg | young giraffe baby small |
| sleep.jpg | giraffe resting sitting |
| habitat.jpg | african savanna giraffe herd |
| family.jpg | three giraffes herd tower |

## Scrape lessons learned

See any of the other book READMEs for the canonical list. Key points for future scraping:

- **Use Wikimedia API** (`commons.wikimedia.org/w/api.php`), not page scraping.
- **Use standard thumbnail sizes**: 500, 960, 1280, 1920, 2560, 2880, 3840 (per $wgThumbnailSteps). Non-standard sizes (640, 800) are rejected with 400/429.
- **Browser-like User-Agent required** for image downloads — non-browser UAs get 403.
- **Aggressive rate limiting**: space API calls by 1s+, downloads by 4s+, pause 20s every 5 downloads. Exponential backoff on 429 (5s, 10s, 20s, 40s).
- **Two-phase approach works best**: resolve all URLs via API first, then download with pacing.
- **Filter out SVGs, PDFs, DJVUs** — Wikimedia search returns many non-bitmap results.
- **Use `iiprop=url|size|mime`** and check MIME type; skip `image/svg+xml`.
- **When `thumburl == url`**, the requested width isn't a standard size — use a standard size instead.

## Credits (fill after scraping)
| File | Source URL | Credit | License | Date downloaded |
|---|---|---|---|---|
| | | | | |
