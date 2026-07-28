# Animals Book — Image Scrape List

## Status: ALL PLACEHOLDERS (emoji fallback active)

All images need to be scraped from Wikimedia Commons / public domain sources.

## Image specifications
- Format: JPG
- Max width: 640px
- Quality: ~80%
- Source: Wikimedia Commons CC BY-SA, USFWS public domain, or similar

## Files to scrape

| File | Search terms |
|---|---|
| elephant.jpg | African elephant savanna |
| tiger.jpg | Bengal tiger portrait |
| dolphin.jpg | bottlenose dolphin jumping |
| bat.jpg | fruit bat flying |
| giraffe.jpg | giraffe closeup |
| lion.jpg | male lion portrait |
| panda.jpg | giant panda eating bamboo |
| kangaroo.jpg | red kangaroo standing |
| whale.jpg | blue whale ocean surface |
| eagle.jpg | bald eagle portrait |
| penguin.jpg | emperor penguin |
| owl.jpg | great horned owl |
| flamingo.jpg | greater flamingo |
| parrot.jpg | macaw parrot colorful |
| turtle.jpg | green sea turtle |
| crocodile.jpg | nile crocodile |
| chameleon.jpg | panther chameleon |
| snake.jpg | green tree python |
| butterfly.jpg | monarch butterfly |
| bee.jpg | honey bee on flower |
| ant.jpg | carpenter ant |
| ladybug.jpg | ladybug on leaf |
| dragonfly.jpg | blue dragonfly |
| octopus.jpg | common octopus |
| shark.jpg | great white shark |
| seahorse.jpg | seahorse |
| jellyfish.jpg | moon jellyfish |
| clownfish.jpg | clownfish anemone |
| coral.jpg | coral reef |
| polarbear.jpg | polar bear |
| wolf.jpg | gray wolf |
| cheetah.jpg | cheetah running |
| orangutan.jpg | orangutan face |
| zebra.jpg | plains zebra |
| rhino.jpg | white rhinoceros |
| redpanda.jpg | red panda |
| hummingbird.jpg | ruby-throated hummingbird |
| frog.jpg | red-eyed tree frog |
| ostrich.jpg | ostrich portrait |
| mantis.jpg | praying mantis |
| starfish.jpg | starfish |

## AFTER SCRAPING
- Move files into this directory
- Update credits below
- Set `ready:true` in `index.html` BOOK_SHELF for animals

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
