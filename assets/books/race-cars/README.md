# Race Cars Book — Image Scrape List

## Status: ALL PLACEHOLDERS (emoji fallback active)

All images need to be scraped from Wikimedia Commons / public domain sources.

## Image specifications
- Format: JPG
- Max width: 640px
- Quality: ~80%
- Source: Wikimedia Commons CC BY-SA, manufacturer/media pages, or similar

## Files to scrape

| File | Search terms |
|---|---|
| formula-car.jpg | formula one car side view |
| rally-car.jpg | rally car dirt road |
| kart.jpg | go-kart racing |
| tyre.jpg | racing tire closeup |
| wing.jpg | formula car rear wing |
| engine.jpg | racing engine |
| brakes.jpg | racing brake disc glowing |
| pitstop.jpg | formula one pit stop crew |
| starting-grid.jpg | race car starting grid |
| helmet.jpg | racing helmet |
| roll-cage.jpg | roll cage interior |
| firesuit.jpg | racing fire suit |
| checkeredflag.jpg | checkered flag finish |

## AFTER SCRAPING
- Move files into this directory
- Update credits below
- Set `ready:true` in `index.html` BOOK_SHELF for race-cars

## Scrape lessons learned (2026-07-28)

- **Use Wikimedia API** (`commons.wikimedia.org/w/api.php`), not page scraping.
- **Standard thumbnail sizes**: 500, 960, 1280, 1920, 2560, 2880, 3840 (per `$wgThumbnailSteps`). Non-standard sizes (640, 800) get 400/429.
- **Browser-like User-Agent** required for image downloads — non-browser UAs get 403.
- **Rate limiting**: space API calls 1s+, downloads 4s+, pause 20s every 5 downloads. Exponential backoff on 429 (5s, 10s, 20s, 40s).
- **Two-phase approach**: resolve all URLs via API first, then download with pacing.
- **Filter out SVGs, PDFs, DJVUs** — search returns many non-bitmap results.
- **When thumburl == url** the requested width isn't standard — use a supported size.
- See `scripts/scrape_book_images.py` for the implementation.

## Credits (fill after scraping)
| File | Source URL | Credit | License | Date downloaded |
|---|---|---|---|---|
| | | | | |
