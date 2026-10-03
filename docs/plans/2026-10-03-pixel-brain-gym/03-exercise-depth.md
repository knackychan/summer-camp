# Exercise depth

Approved by Papa's 2026-10-03 follow-up: complete and deepen the eight newly shipped exercises. This extends the pixel presentation and eight-exercise plan. The four additional game proposals remain proposals.

## Contract

- Every new question has a bilingual topic, an optional strategy clue and a concrete explanation. Clues pause input and the timer. Incorrect answers hold a readable explanation until the child chooses to practise the same question or continue. Practice preserves the original score.
- Rounds progress through related challenge types. Authored pools avoid repeating the same item within a round where possible. Beginner rounds stay unclocked.
- Math: sharing and leftovers, equivalent fractions, different equal-piece foods; missing left/right operands and exact division on the live scale.
- Science: build then predict circuit behavior, including series/parallel paths at the hard tier; broader classifications, states/changes and material properties with explanations.
- Language: larger sentence and word pools, explicit grammar progression, sound/spelling distinctions and Bopomofo support. Keep visual alternatives to speech.
- Memory Match: introduce full-board pair finding, retain discovered pairs and briefly reveal mismatches, then finish the board. A board with a mismatch is recorded as needing practice even when subsequently completed.
- Pattern Echo: sequence-length progression, forward/reverse instructions, undo and explicit check. Study timing and saved old items remain supported.
- Existing host, scheduler, grading, offline cache and native controls carry the changes. No new dependency, online question generation or score currency.

## Work

- [x] Shared clue, explanation and unscored retry flow.
- [x] Math depth and focused tests.
- [x] Science depth and focused tests.
- [x] Language depth and focused tests.
- [x] Memory depth and focused tests.
- [x] Responsive/browser checks, offline/saved-item verification and full repository check.
- [x] Update durable specification and record results.

DONE WHEN: the eight games exercise their new variants with locally verified answers, old saved questions still render, explanations and retries do not change the first-attempt score, paused/destroyed scenes leave no live work, and browser plus repository checks pass.

## Shipped progression

| Exercise | Beginner | Middle | Hard |
| --- | --- | --- | --- |
| Fraction Picnic | Halves, quarters and leftovers | Shares, complements and equivalent drawings | Equivalent fractions using thirds through sixths, drawn as up to twelve pieces |
| Balance Lab | Addition/subtraction with either operand missing | Addition, subtraction, multiplication and exact division | Mixed operations with larger values and inverse-operation explanations |
| Circuit Builder | Build a one-switch loop, then predict | Two switches in series | Conductors/insulators; series and parallel prediction |
| Science Sorter | Animals/plants, living/never-living, plant parts | States of matter, phase changes, classroom magnet tests | Vertebrate groups, phase changes, magnetic materials and conductors |
| Sentence Train | Three-word statements and abilities | Descriptions, negatives, questions, location and agreement | Longer sentences, joining clauses, punctuation and sequence |
| Sound Match | Whole spoken words and pictures | Whole words and initial sounds | English rhymes and spelling; Bopomofo initial symbols and whole-word spelling |
| Memory Match | Four cards; targeted pairs before full-board matching | Six then eight cards; full-board matching | Eight, ten, then twelve cards; full-board matching |
| Pattern Echo | Two then three taps, forward | Three through five taps, forward | Four through six taps, alternating forward and reverse |

Sentence Train contains 54 authored sentences, 18 per tier, across 20 teaching concepts. Sound Match contains 36 illustrated words with English, Traditional Chinese and Bopomofo. Sentence/word targets do not repeat within a generated round. Mathematics selects distinct problems; science selects distinct scenarios within the round. All question data, hints, explanations and expected answers are plain JSON.

The list-building sentence accepts both valid orders of its comma-separated fruit items through serialized `acceptedAnswers`. New Bopomofo spellings place the neutral-tone dot before the neutral syllable, following the [Ministry of Education notation manual](https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/html_ch/). Older saved items retain their original answer strings.

## Feedback and memory details

- A compact topic row names the current concept. Clue pauses the scheduler, timer and answer controls without losing the current selection. Back to exercise restores them.
- Correct answers retain brief feedback. Mistakes open an explanation with Practise again and Next; there is no reading deadline. Practice shows the same question and retains the original score, including across saved-round restoration. Answered questions are saved before the explanation opens.
- Full-board Memory Match locks discovered pairs. A mismatch stays visible for 850 ms, then turns over; input is gated during that reveal. The child can always finish the board. A board with any mismatch keeps its original incorrect grade, while a clean board earns its point.
- Pattern Echo plays the original sequence, explicitly labels reverse tasks, then permits Undo, Clear and Check. Reverse sequences are generated so the reversed answer differs from the forward answer. Older saved Echo items still submit automatically as before.
- Clues, review, study, replay and mismatch callbacks use the shared lifecycle. Leaving the game cancels their work. Brain speech queues English/Chinese immediately through the existing speech helper, eliminating the old delayed callback that could speak after leaving.

## Science references

Circuit and classification content was checked against primary educational sources: [EIA electricity](https://www.eia.gov/kids/energy-sources/electricity/science-of-electricity.php), [DOE series/parallel circuits](https://www.energy.gov/articles/how-do-holiday-lights-work), [USGS condensation](https://www.usgs.gov/water-science-school/science/condensation-and-water-cycle), [USGS evaporation](https://www.usgs.gov/water-science-school/science/evaporation-and-water-cycle), [NPS plant parts](https://www.nps.gov/teachers/classrooms/plant-adaptations.htm), [NPS living/nonliving](https://www.nps.gov/teachers/classrooms/craters-ecosystem.htm), and [Exploratorium magnetic response](https://annex.exploratorium.edu/wsw/progress_snacks/diamagnetism_www/). Magnet questions ask what an ordinary classroom magnet can pick up.

## Verification

- Focused suites passed: math (9), science (8), language (12), memory (13) and shared host (24). Checks cover generated answers, JSON round trips, legacy questions, real scene interactions, pause/resume, first-attempt scoring and cleanup.
- Browser matrix: 381/381 checks passed with no page errors. All 17 games were exercised across three tiers and four viewport sizes. The eight expanded games also passed full hard rounds, deliberate mistakes, explanation/retry flow and offline loading. Report: `.tmp/brain-gym-depth-ui/report.json`.
- Final language corrections: 22/22 additional browser checks passed with no page errors. These verify both valid list orders after saving/reloading, corrected neutral-tone placement, touch grading and legacy saved spellings. Report: `.tmp/brain-gym-language-final/report.json`.
- `npm run build:android-web` passed (478 files), followed by `node scripts/check.mjs`: passed, including all discovered test suites. Logs: `.tmp/brain-depth-build.log` and `.tmp/brain-depth-check.log`. The first attempt caught a stale Kitchen stylesheet while another task was editing it; rebuilding after that edit resolved the mismatch.
- Scoped `git diff --check` passed. `docs/SPEC.md` records the shipped progression and learning flow.
