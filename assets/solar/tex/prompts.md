# Locked prompt sheet — pixel-art planet textures (slice 34, Task 2)

Style frame (art-direction.md §10, locked — do not edit mid-generation; change here first):

```
pixel art planet surface, equirectangular map 2:1, flat albedo, no lighting,
no shadow, limited 6-colour palette, hard 1px edges, 50% checkerboard dither,
SNES 16-bit educational game style, base colour <BASE-HEX>, <FEATURES>,
plain black margins, seamless horizontal wrap
--no photorealistic, smooth gradients, blur, anti-aliasing, text, stars,
background, clouds of detail, outline
```

`<BASE-HEX>` = the body's locked `solar-data.js` colour. `<FEATURES>` = art-direction.md §10.4, verbatim.

| Body | Prompt id | Base colour | Prompt |
|---|---|---|---|
| Mercury | `mercury-01` | `#9C8E84` taupe grey | pixel art planet surface, equirectangular map 2:1, flat albedo, no lighting, no shadow, limited 6-colour palette, hard 1px edges, 50% checkerboard dither, SNES 16-bit educational game style, base colour taupe grey #9C8E84, sparse crater speckle: 1-2 px shade dots, ~1 per 200 px², plain black margins, seamless horizontal wrap --no photorealistic, smooth gradients, blur, anti-aliasing, text, stars, background, clouds of detail, outline |
| Venus | `venus-01` | `#E8CDA5` pale sand | pixel art planet surface, equirectangular map 2:1, flat albedo, no lighting, no shadow, limited 6-colour palette, hard 1px edges, 50% checkerboard dither, SNES 16-bit educational game style, base colour pale sand #E8CDA5, 2-3 soft horizontal streaks, light step, low contrast, plain black margins, seamless horizontal wrap --no photorealistic, smooth gradients, blur, anti-aliasing, text, stars, background, clouds of detail, outline |
| Earth | `earth-01` | `#4D7DD1` ocean blue | pixel art planet surface, equirectangular map 2:1, flat albedo, no lighting, no shadow, limited 6-colour palette, hard 1px edges, 50% checkerboard dither, SNES 16-bit educational game style, base colour ocean blue #4D7DD1, blue base oceans with abstract invented dark-green #3E5F3E land blobs (not real geography) and white #FFFFFF cloud swirls plus polar caps, plain black margins, seamless horizontal wrap --no photorealistic, smooth gradients, blur, anti-aliasing, text, stars, background, clouds of detail, outline |
| Mars | `mars-01` | `#C1440E` rust orange | pixel art planet surface, equirectangular map 2:1, flat albedo, no lighting, no shadow, limited 6-colour palette, hard 1px edges, 50% checkerboard dither, SNES 16-bit educational game style, base colour rust orange #C1440E, 2-3 darker maria patches (shade step), white polar caps, one 2px Olympus Mons dot, plain black margins, seamless horizontal wrap --no photorealistic, smooth gradients, blur, anti-aliasing, text, stars, background, clouds of detail, outline |
| Jupiter | `jupiter-01` | `#C88B3A` ochre tan | pixel art planet surface, equirectangular map 2:1, flat albedo, no lighting, no shadow, limited 6-colour palette, hard 1px edges, 50% checkerboard dither, SNES 16-bit educational game style, base colour ochre tan #C88B3A, 5-7 horizontal bands alternating base / light / rust-brown #7A4A2B, one Great Red Spot #B03030 as a ~6x3 px ellipse in the southern hemisphere, plain black margins, seamless horizontal wrap --no photorealistic, smooth gradients, blur, anti-aliasing, text, stars, background, clouds of detail, outline |
| Saturn | `saturn-01` | `#EAD6B8` pale gold | pixel art planet surface, equirectangular map 2:1, flat albedo, no lighting, no shadow, limited 6-colour palette, hard 1px edges, 50% checkerboard dither, SNES 16-bit educational game style, base colour pale gold #EAD6B8, 3-4 subtle pale horizontal bands only, plain black margins, seamless horizontal wrap --no photorealistic, smooth gradients, blur, anti-aliasing, text, stars, background, clouds of detail, outline |
| Uranus | `uranus-01` | `#9FE3E0` cyan | pixel art planet surface, equirectangular map 2:1, flat albedo, no lighting, no shadow, limited 6-colour palette, hard 1px edges, 50% checkerboard dither, SNES 16-bit educational game style, base colour cyan #9FE3E0, near-solid cyan with 2 faint light horizontal bands, nothing else, plain black margins, seamless horizontal wrap --no photorealistic, smooth gradients, blur, anti-aliasing, text, stars, background, clouds of detail, outline |
| Neptune | `neptune-01` | `#3457D5` deep blue | pixel art planet surface, equirectangular map 2:1, flat albedo, no lighting, no shadow, limited 6-colour palette, hard 1px edges, 50% checkerboard dither, SNES 16-bit educational game style, base colour deep blue #3457D5, 1-2 light horizontal streaks, one shadow-step storm dot, plain black margins, seamless horizontal wrap --no photorealistic, smooth gradients, blur, anti-aliasing, text, stars, background, clouds of detail, outline |

Two candidates generated per body (`-a`/`-b` suffix on the prompt id above). Final palette-lock always runs through the §10.2 ramp math regardless of what the generator returns — the prompt sets composition and mood, the script enforces the locked palette exactly.
