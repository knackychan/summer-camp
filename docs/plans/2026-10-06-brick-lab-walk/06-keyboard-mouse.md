# Slice 06 — Keyboard and mouse

**Requested by Papa, 2026-10-06.** Implements design.md W11.

**Depends on:** 03, 04.

## Changes
- `js/brick-lab/brick-walk-view.js` — while walking: W A S D walk (and arrow keys), a left-button drag looks, Space jumps, V switches the view, R turns the part, a left click without dragging (under `DRAG_START`) places at the crosshair, a right click removes (context menu suppressed on the view only). Keys are listened to only while walking and removed on exit. No pointer lock.

**DONE WHEN:** `check.mjs` green; in a desktop browser every key and click above works and none of them does anything outside walking.
