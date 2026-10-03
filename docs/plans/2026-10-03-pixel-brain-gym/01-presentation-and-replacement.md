# Pixel Brain Gym implementation

Depends on the existing Brain host, scene contract, world navigation and offline bundle.

- [x] Restyle the shared shell and existing scenes; use native buttons, large targets and reduced motion.
- [x] Add tactile counting and coin removal, plus keyboard calculation input.
- [x] Replace Number Cruncher with Number Bonds; preserve history and reject incompatible old resumes.
- [x] Retire City Drive from manifests, navigation and precache.
- [x] Cache the new scene and rebuild the common web/Android payload.
- [x] Verify all nine games at three tiers at phone/tablet widths, correct-round completion, Back, reduced motion and offline loading.
- [x] Run the repository check and focused regressions; update the shipped contract.

DONE WHEN: all games remain playable through the authoritative root runtime; no clipped answer controls; new bonds rounds finish and score; City Drive cannot launch; new scene loads offline; focused checks and `node scripts/check.mjs` pass.

Validation commands:

```powershell
npm run build:android-web
node --test scripts/brain-scenes.test.mjs scripts/brain-host.test.mjs scripts/core.test.mjs scripts/brain-bonds.test.mjs scripts/registry.test.mjs scripts/content-registry.test.mjs
python scripts/check-brain-gym-ui.py
node scripts/check.mjs
```

Do not run bundle builds and the full repository check concurrently: build-tool tests replace generated output. Browser screenshots/report are written to `.tmp/brain-gym-ui`.

## Verification result

- 138 focused tests passed; the 42 host/scene checks passed again after the keyboard and guided-retry review fixes.
- 124 browser checks passed with zero page errors: 360×740, 768×1024, 800×600 and 1024×768; every game/tier, minimum touch targets, available play area, unobstructed controls, coin removal, a complete Number Bonds round, Back to the world, reduced motion and service-worker offline reload.
- `npm run build:android-web` passed.
- Final `node scripts/check.mjs` passed after simultaneous Kitchen Quest work supplied its stylesheet and competing builds finished. No commit or deployment was made.
