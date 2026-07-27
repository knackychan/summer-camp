# Schedule editing — day board time gutter

Approved by Papa 2026-07-27. Built the same day; no pending slices.

Supersedes nothing. Extends `2026-07-27-admin-ops-redesign/22-day-board.md` (which
gave the board its drag-to-reorder) with the ability to change the clock itself.

## The problem

The day board could reorder blocks but not re-time them: `saveDraggedOrder`
permutes blocks across the *existing* set of start times. "We're running twenty
minutes late" had no gesture. The only time editor was the tablet's Papa tools
sheet — the wrong device for Papa's own admin.

## D1 — There is no duration, and we are not adding one

`day-data.js` blocks carry a start `t` and nothing else; a block ends when the
next one starts. So "resize a bracket" always means "move the next block's
start". Adding a `dur` field would mean overlap and gap rules in `time-core`,
`lock-core`, My Day, the board and `check.mjs` all agreeing. Rejected. The UI
edits start times only, and says so.

## D2 — Dragging ripples

Dragging a block moves **that block and every later one** by the same delta.

This is the load-bearing decision. It matches how a family day actually slips
(lunch runs long, the whole afternoon shifts), and it makes overlap
*structurally impossible* — the tail travels together, so relative order can
never change. That is why there is no collision handling anywhere in the
schedule code, and why `scripts/test-time-core.mjs` asserts order is preserved
through a fully-clamped shift. If ripple is ever replaced with single-block
drag, overlap handling has to be written from scratch at the same time.

Moving one block alone stays possible through the row's `<input type="time">` —
native picker, coarse-pointer friendly, zero code. Two gestures, one rule each.

Clamping: 5-minute snap; the group may not cross the block above it (min) or
pass 23:55 (max). `DRAG_PX` in `admin.js` is the feel knob — pixels of travel
per 5-minute step.

## D3 — Two scopes, because both reasons are real

Papa named both: *"some day could be because it's late, and some time because I
want to adjust the whole template."*

| Scope | Means | Storage |
|---|---|---|
| Everyone / one kid | today only | `day_overrides` (`kid_id='all'` or a kid id) |
| Every day | the plan itself, from now on | `family_settings.day_template_times` |

A chip group on the board head picks the scope; the same drag serves all of
them. Today beats every-day: a kid with a today-override keeps it even after a
template change, which is correct — but means a template edit can look like it
did nothing for that kid. The cell's "moved" badge is what explains it.

## D4 — The template is stamped onto DAY, not layered

`family_settings` was chosen over a new table because it is already loaded,
already cached offline, already realtime-subscribed on both sides — the template
cost zero schema.

`SQTime.applyTemplate(DAY, map)` writes the template times onto the `DAY` array
itself and stashes the `day-data.js` value in `b.t0`. So there is no third
precedence rule: every consumer keeps reading `DAY[i].t` and just sees different
times. `t0` is what makes a template entry clearable back to the file value, and
what `saveTemplateTimes` compares against to decide delete-vs-write.

Consequence to remember: `DAY[i].t` is the *template* base at runtime, not the
file value. `saveBlockTime`'s "equal to base ⇒ delete the override" check is
correct because of this, not in spite of it.

`day-data.js` stays the source for anything the template does not cover, and
`check.mjs` reads the file, so it is unaffected.

## Not built

- **Proportional timeline** (row height = duration, drag the bottom edge). Nicer,
  but a full board re-layout across three kid columns, plus edge hit-targets that
  fight a coarse pointer, plus explaining that the edge you grabbed belongs to the
  next block. Add only if the gutter drag proves too blunt.
- **"Reset times" button.** Typing the base time back deletes the override, and
  "Reset day" already sits in that header — a second reset invites the wrong one.
- **Editing block titles/text from the admin.** Still `js/day-data.js`, still
  bilingual-checked by `check.mjs`.
