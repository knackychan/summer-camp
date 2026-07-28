# assets/solar/ — NASA public-domain planet photos

Vendored for offline-first (design D8). All images are ≤ 640 px wide, quality ~80.
These are the images displayed in the holo info card — the 3D scene stays flat-shaded.

| File | Source | Credit |
|---|---|---|
| `sun.jpg` | NASA SDO | NASA/SDO |
| `mercury.jpg` | NASA MESSENGER | NASA/Johns Hopkins University APL/Carnegie Institution of Washington |
| `venus.jpg` | NASA Mariner 10 / processed by Ricardo Nunes | NASA |
| `earth.jpg` | NASA Apollo 17 | NASA |
| `mars.jpg` | ESA Rosetta / processed by ESA | ESA/MPS/UPD/LAM/IAA/RSSD/INTA/UPM/DASP/IDA |
| `jupiter.jpg` | NASA Cassini-Huygens | NASA/JPL/Space Science Institute |
| `saturn.jpg` | NASA Cassini | NASA/JPL/Space Science Institute |
| `uranus.jpg` | NASA Voyager 2 | NASA/JPL |
| `neptune.jpg` | NASA Voyager 2 | NASA/JPL |

Downloaded 2026-07-27. All public domain (NASA/ESA origin).

## Moons, dwarf planet, galaxy, nearby stars (added 2026-07-28)

Sourced from Wikimedia Commons the same way as the original set: real spacecraft/telescope
photography, resized to ≤640px wide, quality ~80. `iss.jpg` was skipped (not needed yet).
`sirius.jpg`'s source frame was small (369×403) — 2x-upscaled with Magnific
(`images_upscale`, `ultra-photo`) before resizing down to spec, per art-direction.md §6.2's
sanctioned use of Magnific as photo enhancement, never for the pixel-art game textures.

| File | Source | Credit |
|---|---|---|
| `moon.jpg` | Wikimedia, Gregory H. Revera | CC BY-SA 3.0 |
| `deimos.jpg` | NASA Viking Orbiter | NASA/JPL |
| `io.jpg` | NASA/JPL Galileo | NASA/JPL/USGS |
| `europa.jpg` | NASA/JPL Galileo (PIA19048) | NASA/JPL-Caltech/SETI Institute |
| `ganymede.jpg` | NASA/JPL Voyager 2 mosaic | NASA/JPL |
| `callisto.jpg` | NASA/JPL Galileo | NASA/JPL |
| `titan.jpg` | NASA/JPL/Space Science Institute Cassini | NASA/JPL/Space Science Institute |
| `triton.jpg` | NASA/JPL Voyager 2 mosaic | NASA/JPL |
| `pluto.jpg` | NASA/JHUAPL/SwRI New Horizons | NASA/JHUAPL/SwRI |
| `milkyway.jpg` | ESO wide-field panorama | ESO |
| `alphacentauri.jpg` | NASA/ESA Hubble | NASA/ESA/STScI |
| `sirius.jpg` | NASA/ESA Hubble, Magnific 2x upscale | NASA/ESA/H. Bond and E. Nelan (STScI) |
| `barnardstar.jpg` | ESO wide-field (eso1837d) | ESO |
| `iss.jpg` | NASA (ISS072e316172, October 2024) | NASA |

Downloaded 2026-07-28.

## Galaxy-mode backdrop texture

| File | Source | Credit |
|---|---|---|
| `milkyway-sky.jpg` | ESO wide-field panorama, Magnific `ultra-photo` 2x enhanced from the full-res source, then downsampled to 1600×800 | ESO |

`milkyway-sky.jpg` is a separate file from `milkyway.jpg` — it's the full-sphere backdrop texture for
Galaxy mode (`js/games/solar.js`'s `mwBackdrop`, a 2:1 equirectangular wrap), not the info-card photo.
Same ESO source as `milkyway.jpg`, but upscaled from the full-resolution master before downsampling so
it reads clean at full-screen size instead of showing the card photo's JPEG blockiness.
