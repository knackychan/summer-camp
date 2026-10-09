# 04 — Clean up sheet: Photos and Passes tabs

**Depends on:** slice 02 (tab framework).

## Scope
- `js/admin-cleanup.js` — `buildRows('photos' | 'passes', …)`: photos show kid, day, block; passes show kid, kind (golden / excused), status, reason.
- `js/admin.js` — two more tabs on the same table; `admin_delete_rows('photos'|'passes', ids)` and `admin_clear(…, kid)`; photo Storage paths removed best-effort after the rows (design D4). A spent pass that has already excused a block is deleted as a row only — the day it excused is not recomputed (stated in the confirm card).

Untouched: pass granting, photo upload, the kid app.

## DONE WHEN
- `node scripts/check.mjs` green; helper tests extended and green.
- Database test: both categories delete selected rows and clear per kid; returned `paths` match the deleted photo rows.
- Browser check: delete one photo and one pass; rows vanish from the tab and from the Photos / Passes views after `loadAll()`; a failed Storage removal shows the "files left in Storage" note and does not undo the row delete.

## Build notes
Built 2026-10-09 with slice 01. Database test checks returned `paths` against the deleted photos; browser check deletes Luis's photos with a failing Storage removal (rows stay deleted, the "Files left in Storage" note shows) and clears Luis's passes (the spent-pass line is in the confirm card). Storage deletion needed a parent-only delete policy on the two buckets (design.md build notes).
