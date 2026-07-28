# Pixel planet textures — provenance (slice 34)

## Task 1 — the tooling gate

**Enumeration (2026-07-28):**
- Project `.mcp.json` configures exactly one server: `github` (no image-generation tool).
- Session tool list additionally exposes a **Magnific MCP** connector (not project-configured — a session/account-level connector) with genuine text-to-image generation (`images_generate`, model catalog via `images_models_list`) in addition to its upscale/edit tools. Cost checked via `simulate_cost`: ~75 credits/image on `imagen-nano-banana-2-flash`, negligible against the account's available balance.

**Route: A** — a generation-capable MCP exists. Confirmed with Papa (2026-07-28) before spending any credits. Per §10.5, Magnific's upscaler is never used on the pixel maps themselves — only `images_generate` (text-to-image), followed by hand palette-locking to §10.2.

## Per-map provenance

| Planet | Route | Tool | Prompt id | Palette-lock date | Size |
|---|---|---|---|---|---|
| Mercury | A | Magnific `images_generate` (imagen-nano-banana-2-flash) + Pillow palette-lock script | `mercury-01` | 2026-07-28 | 1.0 KB |
| Venus | A | Magnific `images_generate` (imagen-nano-banana-2-flash) + Pillow palette-lock script | `venus-01` | 2026-07-28 | 1.0 KB |
| Earth | A | Magnific `images_generate` (imagen-nano-banana-2-flash) + Pillow palette-lock script | `earth-01` | 2026-07-28 | 1.8 KB |
| Mars | A | Magnific `images_generate` (imagen-nano-banana-2-flash) + Pillow palette-lock script | `mars-01` | 2026-07-28 | 1.5 KB |
| Jupiter | A | Magnific `images_generate` (imagen-nano-banana-2-flash) + Pillow palette-lock script | `jupiter-01` | 2026-07-28 | 1.3 KB |
| Saturn | A | Magnific `images_generate` (imagen-nano-banana-2-flash), reprompted for a clean band-only strip + Pillow palette-lock script | `saturn-02` | 2026-07-28 | 1.1 KB |
| Uranus | A | Magnific `images_generate` (imagen-nano-banana-2-flash) + Pillow palette-lock script | `uranus-01` | 2026-07-28 | 1.0 KB |
| Neptune | A | Magnific `images_generate` (imagen-nano-banana-2-flash), reprompted after the first candidate drew an Earth-like landmass by mistake + Pillow palette-lock script | `neptune-02` | 2026-07-28 | 1.0 KB |

All eight ≤ 40 KB budget (§10.1), PNG-8 indexed, ≤ 8 colours each, reviewed together as a set and approved by Papa (2026-07-28).

Generation gives composition/mood only; every map is then forced through the exact §10.2 ramp math (highlight/light/base/shade/shadow + permitted accents) by script — nearest-colour quantized at full resolution, then majority-pooled down to 128×64 (not a naive resize, which would alias against the source's checkerboard dither and bias the result toward whichever colour happened to land on the sampled pixels). This is the automated equivalent of the Piskel hand-lock Task 3 describes: same ramp math, same ≤ 8-colour ceiling, scripted instead of painted pixel-by-pixel. See `prompts.md` for the exact prompt sheet.
