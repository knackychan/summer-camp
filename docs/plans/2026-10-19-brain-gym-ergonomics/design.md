# Brain Gym ergonomics pass

Requested by Papa on 2026-10-19: "the different practice / gym brain exercises to memorize, we need to put a clear countdown number appearing in the center or in another area (to avoid cluttering the kids' eyes) with a sound of tick-tock to let them know that they need to remember, with a circle that gets smaller and smaller as time goes", then a pass on the ergonomics of every Brain Gym exercise, and "check text size for all tablet sizes down to 1280 x 600". Built the same day, waiting on Papa's look on a tablet.

Presentation only: generators, scoring, study durations, items and daily selection are unchanged.

## D1 One study timer for every memorize phase

`js/brain/study-timer.js` is shared by the three exercises that have a timed "look and remember" phase: Memory Match (`studyMs`), Low to High (`flashMs`) and Word Memory (`studyMs`, all three tiers and the yes/no mode). Pattern Echo is a watched playback, not a timed study, and keeps its "Watch 2/4" counter; Math Recall's first card is self-paced with Next.

- A big whole-seconds number on a mint disc that shrinks to nothing as the study time runs out (dashed outline keeps the full size visible). The number reaches 0 exactly when the study phase ends.
- It sits in its own slot beside the items, never over them: Memory Match uses the left column where "Find both … cards" appears afterwards; Low to High and Word Memory put it left of the numbers or words.
- The last 3 seconds turn the disc yellow. No red, no buzzer (coach, not cop).
- Every second goes through the round scheduler, so the Clue overlay, a hidden tab and quitting freeze or stop it like everything else.
- Reduced motion: the disc steps once per second instead of gliding.

## D2 Tick-tock

Two new synthesized cues, `clock-tick` and `clock-tock` (soft wooden clock, under 60 ms, quiet), alternate once per second. Word Memory's middle and hard tiers study for 45–60 s; ticking all that time would drown the words, so only the last 10 seconds tick. The disc and number run the whole time. Mute silences them like every other cue.

## D3 Nothing else to look at while studying

While a generic-scene study runs, the answer side keeps its space but is hidden (the empty Low to High entry box and the disabled Word Memory typing box used to sit there). Word Memory's little-kid tier said "Which one disappeared?" before anything had; it now says "Remember these pictures 記住這些圖片" while studying. The old Word Memory counter stayed on screen at 0 after study because its CSS overrode `hidden`; it is replaced by the timer.

## D4 Readability floor: 16 px

Measured on every exercise and tier at 1280×600: Chinese subtitles fell to 10–13 px, several buttons kept the browser's 13 px default, and Calculations keys were under 16 px. No kid-facing text in a round goes below 16 px now (Memory Match's corner card numbers 15 px). Low to High study numbers and Word Memory words are larger. `scripts/check-brain-text-size.py` measures every visible text run at 1280×600, 1280×800, 1340×800 and 1920×1200, in the study and answer phases and the Clue / review overlays; `scripts/check-brain-tablet-ui.py` still proves nothing is clipped.

## D5 Smaller fixes found in the review

- Word Memory with the Zhuyin keyboard: at 1280×600 the Done button sat below the round and had to be scrolled to (already true before this pass). "Easier: pick the words" and Done now share the last row.
- Circuit Builder: the "Battery 電池" caption sat on the wire; it moved right of the cell.
- Calculations, Low to High and Math Recall number keys: bigger digits in the same key size. Math Recall's Next button text went from 13 px to 22–30 px.
- Pattern Echo buttons no longer wrap "Check pattern" onto two lines.
