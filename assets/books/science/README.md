# Science Book — Image Scrape List

## Status: ALL PLACEHOLDERS (emoji fallback active)

All images need to be scraped from Wikimedia Commons / public domain sources.

## Image specifications
- Format: JPG
- Max width: 640px
- Quality: ~80%
- Source: Wikimedia Commons CC BY-SA, NASA, or similar public/educational sources

## Files to scrape

| File | Search terms |
|---|---|
| solid.jpg | ice crystals solid state |
| liquid.jpg | water droplet liquid |
| gas.jpg | steam rising |
| gravity.jpg | apple falling gravity |
| magnets.jpg | bar magnets attracting |
| friction.jpg | tire on road friction |
| light.jpg | prism rainbow light |
| sound.jpg | sound waves visualization |
| electricity.jpg | lightning bolt |
| volcano.jpg | erupting volcano |
| cloud.jpg | cumulus cloud sky |
| rainbow.jpg | rainbow landscape |
| heart.jpg | human heart diagram |
| lungs.jpg | human lungs diagram |
| brain.jpg | human brain illustration |
| skeleton.jpg | human skeleton |
| photosynthesis.jpg | leaf photosynthesis sun |
| watercycle.jpg | water cycle diagram |

## AFTER SCRAPING
- Move files into this directory
- Update credits below
- Set `ready:true` in `index.html` BOOK_SHELF for science

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
