# Public Vehicles Book — Image Scrape List

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
| ambulance.jpg | ambulance emergency vehicle |
| firetruck.jpg | fire truck ladder |
| policecar.jpg | police car lights |
| bus.jpg | city bus transport |
| train.jpg | passenger train |
| tram.jpg | street tram city |
| garbagetruck.jpg | garbage truck collection |
| mailtruck.jpg | mail delivery truck |
| streetsweeper.jpg | street sweeper vehicle |
| towtruck.jpg | tow truck |
| schoolbus.jpg | yellow school bus |
| taxi.jpg | taxi cab |
| helicopter.jpg | rescue helicopter |

## AFTER SCRAPING
- Move files into this directory
- Update credits below
- Set `ready:true` in `index.html` BOOK_SHELF for public-vehicles

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
