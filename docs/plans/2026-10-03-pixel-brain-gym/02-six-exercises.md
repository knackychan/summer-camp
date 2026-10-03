# Eight interactive exercises

This records the initial release. [The depth follow-up](03-exercise-depth.md) supersedes its fixed question progression and memory modes.

Approved by Papa on 2026-10-03: implement all six exercises suggested after the pixel refresh, add memory games, then suggest further exercises.

Use the existing Brain host, serializable question data, exact local grading, three tiers, daily selection, scoring and service-worker cache. Every scene uses bilingual native touch/keyboard buttons, the shared pixel palette and scheduler-managed motion. No new dependency or remote generation.

- [x] Fraction Picnic (`fractions`): select equal sandwich squares to match a share; progress to equivalent fractions.
- [x] Balance Lab (`balance`): choose number blocks on a live scale to solve missing addends, subtraction and multiplication.
- [x] Circuit Builder (`circuit`): open/close one or two switches in a series circuit; test conductors and insulators in the hard tier.
- [x] Science Sorter (`sorter`): classify plants/animals, states of matter, then animal groups; each answer has a bilingual reason.
- [x] Sentence Train (`sentence`): arrange indexed word carriages into an English sentence; repeated words, removal and reset work. Read it after checking.
- [x] Sound Match (`soundmatch`): hear English or Chinese and match a picture, word or Bopomofo spelling. Replay and Show word keep it usable with or without speech.
- [x] Memory Match (`memorymatch`): study 4/6/12 picture cards, then locate both copies of a target. Study lasts 4/4.5/5 seconds. Hidden cards retain their positions.
- [x] Pattern Echo (`patternecho`): watch and repeat 2/4/6 numbered, illustrated pads. Replay, clear and repeated pad values work; shape and number cues supplement colour and sound.
- [x] Wire all eight through the catalogs and offline cache.
- [x] Test generators, real inputs, scoring, serialized questions, phone/tablet layout, reduced motion and offline launch.
- [x] Record shipped behavior and a new proposal list.

DONE WHEN: all eight are findable and playable in the real app in each tier, complete through the existing score flow, work offline and pass focused tests plus the repository check. New ideas remain suggestions until separately approved.

## Shared behavior

Beginner rounds have no clock. All eight store plain JSON question data and grade exact answers, so saved rounds retain their solutions. Memory study/playback uses the shared scheduler, freezes while the page is hidden, and resolves pending presentation when a round is destroyed. A round opened in a hidden tab starts paused. Native Space activates focused buttons; legacy typing handlers no longer swallow it inside Brain Gym.

The exercise scenes reuse the current pixel shell, native buttons, sound cues and motion service. They add no dependency. Speech depends on installed device voices; Sound Match always offers a written clue. English/Chinese Brain speech uses `en-US`/`zh-TW`; the separate arcade French speech remains separate.

## Next ideas — proposals only

| Subject | Exercise | Interaction |
| --- | --- | --- |
| Math | Number Line Hop / 數線跳跳 | Place a frog on the estimated number, then use hops for addition and subtraction. |
| Science | Magnet Detective / 磁鐵偵探 | Predict which named materials a magnet attracts, then test them. Include metals that are not attracted. |
| Language | Word Workshop / 單字工坊 | Build a pictured word from English letters or Bopomofo tiles, with optional spoken clues. |
| Memory | What's Missing? / 少了什麼？ | Study a small pixel room, then identify the object that disappeared or moved. |

These are original activity ideas, not claims of measured learning improvement.

## Verification

- 165 focused tests passed across the Brain scenes, host, generated content and registries. The four expansion suites include 26 tests with seeded generator sweeps, serialized grading and real scene interactions.
- `npm run build:android-web` passed.
- `node scripts/check.mjs` passed, including all repository test files, syntax, bilingual content and offline module registration. The checker now finds the Brain gate rule in the extracted app stylesheet; the unrelated late-help test waits for its provider to start instead of racing a 50 ms timeout.
- `python scripts/check-brain-gym-ui.py`: 272/272 checks passed with zero page errors. All 17 games and three tiers were checked at 1024×768, 768×1024, 800×600 and 360×740. All eight new games completed with an intentional wrong answer followed by correct answers, then opened after offline reloads. Keyboard Space, undo/replay, silent clues, cleanup and precaching passed.
- Screenshots and the browser report are generated locally under `.tmp/brain-gym-ui/`.
