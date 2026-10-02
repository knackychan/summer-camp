# Summer Quest

Family summer-camp PWA-style app for Lucien, Lili, and Luis.

> **Current runtime (v0.6.2-recovery, 2026-10-02):** `index.html` owns child navigation, state and content launches on web/PWA and Android. Classic and the **Miniature 3D World** share the root launch API and `SQContentRegistry`. The old `apps/kid/` URL redirects to root; its historical shell source is excluded from compilation, packaging and caching. Android packages the root runtime in a thin Capacitor container. See the [recovery plan](docs/plans/SUMMER-QUEST-ARCHITECTURE-RECOVERY-PLAN.md) and [validation results](docs/audits/SUMMER-QUEST-ARCHITECTURE-RECOVERY-RESULTS.md), including the pending physical tablet checks.

### Miniature 3D World (v0.6.1)

Hero selection now opens the root runtime's real WebGL exploration surface. The island uses the repository's vendored Three.js/OrbitControls, supports touch drag/rotate and bounded pinch/zoom, and exposes physical destinations for Quests, Games, Activities, Learning, Books, Music, Today and Rewards. Smaller world props can open real content directly (currently Monster Truck, Solar System, Space book and Paint). Content launched from the world returns to the same world surface rather than creating another navigation layer. **Classic menu** remains available as a fallback.

The world consumes `SQContentRegistry`; it does not own a second content catalog or router. Future world expansion should add or decorate registry-backed destinations rather than bypassing the root runtime.

## Run Locally

Install dependencies with `npm ci`, then serve the project over HTTP. Use `START-SUMMER-QUEST.cmd` or `npm run agent:serve` (see below) and open the root interface on port 9000. For a local-only static test, build the shared modules below and run `python -m http.server 9000`. Provider keys are optional for the local session loop. Missing `js/config.js` keeps sync in local-only mode.

### Shared runtime modules

The root app uses compiled TypeScript learning, agent, core and storage modules:

```sh
npm run build:mobile
```

Then serve the repository over HTTP and open `/` or `/index.html`. Generated modules are local build output and are not committed.

For Supabase sync, copy `js/config.example.js` to `js/config.js` and fill in the project URL and anon key.

## Install On Tablets

Open the live site in the tablet browser, then use **Add to Home Screen** / **Install app**. The installed app caches the kid app shell for offline launch; admin still needs network for login and live data.

## Verify

```sh
npm run test:mobile
node scripts/check.mjs
```

`test:mobile` checks the retained shared modules and root runtime boundary. `check.mjs` is the required full-project gate. The [recovery results](docs/audits/SUMMER-QUEST-ARCHITECTURE-RECOVERY-RESULTS.md#re-run) include the complete build, native asset and browser checks.

### Summer agent provider routing

The child app never contains LLM provider secrets. Provider/model selection lives behind the protected `server/agent-proxy/` boundary. Routing is still manual-first: the child-safe server defaults to one allow-listed profile, while AI Lab mode permits explicit comparison only when deliberately started by the developer.

For the local/LAN prototype, copy `server/agent-proxy/.env.example` to `server/agent-proxy/.env`, add the provider keys you want to use, then run:

```sh
npm run agent:serve
```

This builds the mobile/agent modules, serves the existing UI on port 9000, injects `/api/summer-agent` into the browser config, and prints LAN URLs for tablets. Provider keys stay only in the Node process.

For Operations → AI Lab multi-model comparisons:

```sh
npm run agent:serve:lab
```

AI Lab mode is developer-only because it intentionally enables manual profile overrides. On Windows, `START-SUMMER-QUEST.cmd` and `START-SUMMER-QUEST-AI-LAB.cmd` provide the same two launch modes. Run `npm run test:agent-routing` and `npm run test:agent-server` to verify the provider/server boundary.

### Adaptive tutoring prototype

v0.3.4 added the deterministic adaptive tutor to Brain Gym Math. v0.3.5 extends the same architecture to Word Wizard Study mode: observable letter/recall difficulty is diagnosed locally, then the tutor can continue, offer a tiny clue, reinforce with picture/audio, reveal exactly one letter, or temporarily use an easier recall scaffold. Copy mode and Potion Shop remain AI-free/unchanged. The LLM can only phrase a hint inside the strategy allow-list selected by the local policy; it never grades, changes levels, chooses the intervention, or reveals arbitrary answers. Run `npm run test:adaptive-tutor` for the combined Math + Language gate or `npm run test:adaptive-language` for Word Wizard only.

### Learning telemetry + tutor policy evidence

v0.3.6 adds one local-first telemetry stream for Math and Language attempts, local tutor interventions, hint source/usage, deterministic adaptation and support outcomes. Browsers keep a bounded local buffer; when the local Summer Quest server is running, events are mirrored best-effort to `/api/learning-telemetry` on the family PC. Operations → Reports prefers that family-wide collector and falls back to the current browser. Raw typed child answers are not stored in the telemetry schema.

v0.3.7 adds **Tutor policy evidence** to the same Reports view. It compares observed outcomes for each deterministic intervention (for example retry recovery, assisted completion, next independent success and later independence), explicitly labels small samples, and exports the evidence with telemetry JSON. This layer is descriptive only: it does not automatically change tutor rules or select a more expensive model. Run `npm run test:telemetry` and `npm run test:tutor-policy-eval` for these gates.

## Deploy

For GitHub Pages, use the included GitHub Actions workflow. Add repository secrets:

- `SQ_SUPABASE_URL`
- `SQ_SUPABASE_ANON_KEY`
- `SQ_NTFY_TOPIC` optional

Then set Pages source to **GitHub Actions**. The workflow writes `js/config.js` during deployment; the file stays uncommitted locally.


### Controlled tutor-policy experiment (v0.3.8)

Tutor experiments are **off by default**. For an intentional adult/developer evaluation run, add this to `server/agent-proxy/.env` and restart the local server:

```text
SUMMER_TUTOR_EXPERIMENTS=math-near-miss-support-v1
```

The first experiment compares two predefined supports only for repeated Math near-miss/counting-slip cases: a visual explanation vs one easier local scaffold. Assignment is stable per learner. It does not change grading, learning level, model routing or curriculum access, and Operations → Reports shows descriptive evidence without automatically choosing a winner.

### Smart Practice Learning Director (v0.3.9)

The existing **Learn** tab now includes a local-first **Smart Practice** session. It does not replace Math or Word Wizard; it coordinates the existing activities into a short deterministic sequence based on the learner profile and recent Math/Language telemetry:

```text
warm-up → focus → reinforce → confidence
```

The director reads observable learning evidence, selects a domain/skill locally, and launches the existing Brain Gym Math or Word Wizard Study activity for two practice items per step. It never grades an answer, changes a learner level, spends rewards, selects an LLM/model, or unlocks curriculum. The underlying activity and adaptive tutor remain authoritative for grading and support. Plans stay fixed while a session is in progress so telemetry cannot reshuffle the child mid-session; starting a new session recomputes the plan from the latest evidence.

Pre-readers are kept on an appropriate Word Wizard mode (Copy rather than Translate/Sentences). Smart Practice works offline and remains usable when all AI providers are disabled. Run `npm run test:learning-director` for the focused gate.

### Curriculum / Skill Map (v0.4.0)

Smart Practice now works with explicit Math and Language skills rather than broad `math` / `vocabulary` labels. The first internal skill map covers addition/subtraction ranges plus Word Wizard copy, recall, translation, sentence recall and Bopomofo. Each skill carries bilingual labels, age/reading constraints, prerequisites/readiness metadata and launch information for an existing activity.

Real Math/Word Wizard attempts are attributed to the exact skill, so the Learning Director v2 can produce plans such as `Word recall → + to 20 → + to 20 → Word recall`. Directed Brain Math generates questions inside the requested operation/range and runs only the Smart Practice attempt count; it does **not** mark the normal Daily Brain Gym complete, alter its best, or award its daily reward. Normal Brain Gym/free play is unchanged when there is no skill constraint.

This is an internal Summer Quest progression scaffold, not yet a formal national-curriculum mapping. Multiplication remains available in normal Brain Gym but is intentionally outside the adaptive skill map until it has the same deterministic tutor/scaffold coverage. Run `npm run test:curriculum` for the focused gate.

### Quick Placement / Calibration (v0.4.1)

The existing **Learn** tab offers an optional **Quick skill check** when Summer Quest has little independent Math/Language history for the selected child. It reuses the real Brain Math and Word Wizard Study activities rather than implementing a second quiz engine. Placement is local and deterministic: adaptive tutor / AI hints are disabled, no stars or Daily Brain progress are awarded, and Word Wizard placement items do not modify the legacy mastery boxes. The child can choose **Later** at any time; Smart Practice remains available.

v0.4.1 introduced a single provisional Math ladder. v0.4.4 supersedes that measurement model with a strand-aware Math starting map while keeping the same child-facing Quick skill check card and the same measurement safeguards.

### Mastery + Review Scheduler (v0.4.2)

Smart Practice now keeps a longitudinal, skill-level mastery/review view derived from the same local learning telemetry. Each curriculum skill is shown as **Starting**, **Building**, **Secure**, or **Review due**. Only independent attempts can advance a skill into Secure; assisted/hinted work never does so by itself.

Secure skills receive a bounded spaced-review interval (1 → 3 → 7 → 14 → 30 days as sustained independent evidence accumulates). When a skill becomes due, the Learning Director can mix one short **Review** step into the existing four-step Smart Practice session instead of letting previously learned material disappear. A new successful independent attempt moves the next review forward; if performance declines, the skill returns to Building and ordinary practice/tutor support takes priority.

The scheduler is deterministic and derived from real attempts rather than a second editable mastery database. It does not grade answers, change learner levels, call an LLM, spend rewards, or autonomously unlock content. Review pressure is deliberately capped so an overdue secure skill cannot crowd out an actively struggling skill. Run `npm run test:mastery` for the focused scheduler gate; `npm run test:curriculum` now includes curriculum + placement + mastery/review + Learning Director coverage.

### Expanded Math Skills + Multiplication Tutor (v0.4.3)

The curriculum map now includes **number comparison**, **number bonds**, and two multiplication strands in addition to the existing addition/subtraction skills. Smart Practice launches these through the same Brain Gym Calculation activity; it does not create a parallel math game.

Directed practice can now request `Compare to 20/100`, `Bonds to 10/20`, `× 2,5,10`, or `× 2–9`. The Brain learning adapter validates each generated item locally and attributes the attempt to the exact requested curriculum skill. Normal Brain Gym/free play remains unchanged when no directed skill is supplied.

Multiplication now participates in the deterministic adaptive tutor. Observable errors such as using addition for a multiplication problem or missing one equal group can trigger locally chosen supports such as **equal groups**, **arrays**, **skip counting**, or a smaller unscored multiplication scaffold. Comparison and number-bond skills likewise have local visual strategies. The LLM may only phrase a hint inside the strategy allow-list selected by the local tutor policy; it still cannot grade, select the intervention, modify mastery/review state, or change curriculum access.

AI Lab's built-in evaluation suite now includes a multiplication case. Run `npm run test:expanded-math` for the focused v0.4.3 gate; `npm run test:curriculum` and `npm run test:adaptive-tutor` remain the broader curriculum/tutoring gates.
### Strand-aware Placement Map (v0.4.4)

Quick skill check now measures Math as several independent strands instead of collapsing everything into one arithmetic ladder. Depending on age, it samples **addition/subtraction**, **number sense**, **number bonds**, and **multiplication**, plus the existing Words track. Each strand starts near an age-appropriate anchor, uses two quick items, and only asks one adjacent confirmation item when the anchor is clearly too easy or too hard. Mixed anchor evidence stops that strand immediately.

Existing independent practice can resolve a strand before the check starts. This means a child with strong real history in, for example, addition/subtraction does not have to repeat that area just because number bonds are new. An explicit **Re-check** ignores that shortcut and samples the full age-eligible map again.

The result is a small starting map rather than one Math level: `Addition & subtraction`, `Number sense`, `Number bonds`, and (when age-eligible) `Multiplication` each get their own provisional start. Learning Director v5 uses those strand-local starts only while evidence is sparse; real independent attempts, mastery and review scheduling remain authoritative over time. Run `npm run test:strand-placement` for the focused gate or `npm run test:curriculum` for the broader curriculum/placement/mastery/director gate.


### Teach / Explain Step (v0.4.5)

Smart Practice can now briefly **teach a Math concept before asking for more practice** when local learning evidence shows repeated difficulty. The normal four-step session stays bounded, but a struggling Math focus can become `warm-up/review → teach → focus practice → confidence` instead of immediately repeating more questions.

The Teach scene is deterministic and rendered inline in the existing Learn UI: object groups for early addition, number-line jumps for addition/subtraction, quantity bars for comparison, part-whole diagrams for number bonds, and equal groups/arrays for multiplication. It is not scored, does not create mastery evidence, and requires an explicit `Got it — practice` acknowledgement before the director advances.

Teach is **local-first and offline-safe**. The visual scene and fallback explanation appear without any agent server. When the protected AI backend is available, the new `lesson_explanation` task may replace only the short bilingual wording. The app fixes the skill, operands, correct answer and allowed visual strategy; if the model changes strategy or fails validation, the local explanation remains authoritative. Run `npm run test:teach` for the focused gate.

### Language Teach / Explain (v0.4.6)

Smart Practice can now insert the same bounded **Teach → practice** pattern for Language / Word Wizard when real local evidence shows repeated difficulty. The existing shared Teach card renders deterministic local scenes for progressive word copying, picture-led word recall, translation mapping, sentence chunking and Bopomofo sound-symbol mapping, then returns the child to the normal Word Wizard mode for real practice.

Language teaching remains local-first and offline-safe. Each scene owns its exact target, spelling/source meaning, visual structure and audio cue. The protected `lesson_explanation` task may only rephrase the short bilingual wording within the one strategy already selected by Summer Quest; it cannot substitute another word, translation, sentence, visual strategy or activity. Learning Director schema is now v7. Run `npm run test:teach` for the combined Math + Language Teach gate or `npm run test:language-teach` for the focused Language gate.

### Granular Language Skill Map (v0.4.7)

Language / Word Wizard now uses real subskills instead of treating each Word Wizard mode as one broad ability. Smart Practice can distinguish **initial sound**, **simple word construction**, **picture vocabulary**, **high-frequency word recall**, **common spelling patterns**, **word-meaning links**, **simple sentence patterns**, **question patterns**, **Bopomofo sound-symbol matching**, and **Bopomofo word construction**.

The existing Word Wizard remains the only practice game. Directed Smart Practice / Placement steps filter its existing word or sentence pool to the selected subskill and, for the two earliest sound skills, reduce only the answer target (for example `cat → c` or `ㄇㄠ → ㄇ`) while preserving the original picture and spoken source. Directed practice is isolated from the legacy Word Wizard collection/mastery boxes, while real learning telemetry is still recorded against the exact granular skill.

Normal Word Wizard play is also classified deterministically into the closest granular skill from the actual target. A small legacy alias layer lets v0.4.6 coarse history seed the nearest base skill (`word_recall → picture vocabulary`, for example) without pretending that old data proves newer specialist skills such as spelling patterns or question frames.

Learning Director schema is now **v8** and placement storage is **v3** so old daily plans / single coarse Language placement state rebuild cleanly. The new rules are local-first, offline-cached and do not ask an LLM to classify the child's language skill. Run `npm run test:language-skills` for the focused Language gate or `npm run test:curriculum` for curriculum + placement + mastery + director coverage.

### Knowledge Lesson Runtime / Science (v0.4.8)

The existing **Learn** tab now includes a local-first **Science Lab** to prove that the tuition architecture works beyond Math and Language. The first bank contains six short bilingual lessons: Animals, Plants, Human Body, Matter, Weather and Space. Every lesson owns its fixed facts, touchable visual model, two questions, correct answers and explanations; correctness never comes from the LLM.

Science attempts enter the same unified learning telemetry under `domain: science` and concrete `science.*` skill IDs. This gives later mastery/review and Learning Director work a shared evidence source instead of a separate Science tracker.

The optional protected `knowledge_lesson` agent task is deliberately narrower than free-form lesson generation. It may only choose/reorder fact IDs and question IDs already present in the selected deterministic lesson plus a bounded presentation/encouragement enum. Unsupported IDs reject the remote result and keep the offline local plan. The model therefore cannot invent a new science fact, answer or question in the child-facing lesson.

The Science runtime is cached under `summer-quest-v100-science-smart-practice` and remains fully usable without an agent server. Run `npm run test:knowledge` for the focused gate.

### Science Smart Practice + Mastery / Review (v0.4.9)

Science now participates in the same deterministic **Smart Practice**, **Mastery** and **spaced-review** loop as Math and Language. The six approved Science concepts live in the shared curriculum catalog and can become a focus when independent evidence shows that a concept is still Building, or can return later when a previously Secure concept becomes Review due.

A normal Science Smart Practice focus opens the existing local-first Science Lab in **Explore** mode: the child sees the approved visual/facts and then answers the lesson's two locally graded questions. A spaced Science review opens the same lesson in **Check** mode and goes directly to those two questions; it does not ask AI to resequence the measurement. A Science focus appears only once in a short Smart Practice plan, so the same two-question lesson is not duplicated as a separate reinforce step.

Science mastery continues to be derived from the shared telemetry. Only independent attempts can establish Secure or move the review anchor; assisted presentation does not create mastery on its own. The optional `knowledge_lesson` model may still adapt only approved fact/question ordering during Explore mode. It cannot grade, choose mastery state, set review timing, invent curriculum content or alter the selected Smart Practice skill. The updated offline app shell uses `summer-quest-v100-science-smart-practice`.

Run `npm run test:science-adaptive` for the focused Science + director/mastery gate, or `npm run test:knowledge` for the complete Science runtime gate.

### Geography / Map Explorer Knowledge Runtime (v0.5.0)

The shared **Knowledge Lesson Runtime** is no longer Science-specific. The existing Learn tab now also includes **Map Explorer**, proving that the same deterministic lesson/session engine can carry a second knowledge subject without duplicating grading, storage, telemetry or the protected AI boundary.

The first Geography bank contains six bilingual lessons: **Compass Directions**, **Map Symbols**, **Land & Water Features**, **Continents & Oceans**, **Equator & Hemispheres**, and **Environment Clues**. Each lesson owns its approved facts, touchable visual model, exactly two locally graded questions, correct answers and explanations. Geography attempts enter unified learning telemetry under `domain: geography` and concrete `geography.*` skill IDs.

The `knowledge_lesson` agent task is now domain-neutral: Science and Geography both send only an approved fact/question allow-list. AI may sequence those approved IDs and select a bounded presentation tone, but it cannot invent a place/fact, alter an answer, grade the child, or choose progression. Science Smart Practice / Mastery remains unchanged in v0.5.0; Geography intentionally starts as free local-first evidence, ready for the same adaptive integration in a later slice.

The offline app shell uses `summer-quest-v101-geography-map-explorer`. Run `npm run test:geography` for the focused Geography gate or `npm run test:knowledge` for Science + Geography Knowledge Runtime coverage.


### Geography Smart Practice + Mastery / Review (v0.5.1)

Geography now participates in the same deterministic **Smart Practice**, **Mastery** and **spaced-review** loop as Math, Language and Science. The six Map Explorer concepts are registered in the shared curriculum catalog and can become a Smart Practice focus from real local evidence, or return later when a previously Secure concept becomes Review due.

A normal Geography Smart Practice step opens the existing **Map Explorer** in **Explore** mode: the approved map model/facts appear first, followed by the lesson's two locally graded questions. A spaced review opens the same deterministic lesson in **Check** mode and goes directly to the two questions. Geography uses the same three-step bounded Knowledge-session shape as Science, so one two-question lesson is never duplicated as both Focus and Reinforce.

Learning Director schema is now **v10**. Its Knowledge launch contract is domain-neutral (`science` or `geography`) and carries a shared `knowledgeMode: explore | check`; the previous `scienceMode` field remains readable as a compatibility alias for older persisted Science plans. Quick Placement remains Math + Language only. Geography mastery and review timing come only from independent attempt telemetry; AI may still reorder only approved facts/questions during Explore mode and cannot grade, select skills, set mastery, or change review timing.

The offline app shell uses `summer-quest-v102-geography-smart-practice`. Run `npm run test:geography-adaptive` for the focused Geography + director/mastery gate, `npm run test:geography` for the complete Geography gate, or `npm run test:knowledge` for Science + Geography Knowledge coverage.

### History / Time Traveler Knowledge Runtime (v0.5.2)

The shared **Knowledge Lesson Runtime** now carries a third knowledge subject: **History**. The existing Learn tab includes **Time Traveler / 時光旅行家** with six deterministic bilingual lessons covering Past & Present, Before & After, historical sources, Ancient Egypt, Ancient China, and communication change over time. Every lesson owns its approved facts, touchable clues, exactly two questions, correct answers and explanations; grading remains local.

History attempts enter the same unified telemetry under `domain: history` and concrete `history.*` skill IDs. Learner profiles normalize the new History domain so existing stored profiles remain compatible. History intentionally does **not** join Smart Practice / Mastery / Review yet in v0.5.2; this release first validates the subject runtime and evidence path, following the same staged rollout used for Science and Geography.

The protected `knowledge_lesson` task remains allow-list only. It may sequence approved History facts/questions and select a bounded presentation tone, but it cannot invent historical claims, change answers, grade the learner, or choose curriculum progression. The offline app shell uses `summer-quest-v103-history-time-traveler`. Run `npm run test:history` for the focused History gate or `npm run test:knowledge` for the complete Science + Geography + History Knowledge gate.

### History Smart Practice + Mastery / Review (v0.5.3)

History now participates in the same deterministic **Smart Practice**, **Mastery** and **spaced-review** loop as Science and Geography. The six Time Traveler concepts are registered in the shared curriculum catalog and can become a focus when independent History evidence is weak, or return later when a previously Secure concept becomes Review due.

A normal History Smart Practice focus opens the existing **Time Traveler** lesson in **Explore** mode: the approved time/evidence visual and curated facts appear first, followed by exactly two locally graded questions. A spaced History review opens the same deterministic lesson in **Check** mode and goes directly to those questions, with AI resequencing disabled. History uses the same three-step bounded Knowledge-session shape as Science and Geography so one two-question lesson is never duplicated as Focus + Reinforce.

Learning Director schema is now **v11** and its generic Knowledge launch contract supports `science`, `geography` and `history` through the shared `knowledgeMode: explore | check`. Older v10 daily plans rebuild automatically. Quick Placement remains Math + Language only. History mastery and review timing come only from independent attempt telemetry; the protected `knowledge_lesson` model may still reorder only approved content during Explore mode and cannot grade, select skills, set mastery, or change review timing.

The offline app shell uses `summer-quest-v104-history-smart-practice`. Run `npm run test:history-adaptive` for the focused History + director/mastery gate, `npm run test:history` for the complete History gate, or `npm run test:knowledge` for the full Science + Geography + History Knowledge coverage.


### Current guided-session coordination (v0.5.4)

The existing **Learn → Smart Practice** card now supports Start/Resume, Another choice, Pause and Finish for now across Math, Language, Science, Geography and History. After validated evidence completes a step, the Director uses current evidence to suggest the next eligible activity; the child still chooses when to start. This updates the historical v0.3.9 fixed-plan description above: the active activity is stable, while the next unstarted slot may adapt at a completion boundary.

Guided progress is run-bound and duplicate-safe, with committed partial counts retained across reload. Finishing early is not completing unfinished work. Knowledge lessons resume at their saved position. Existing bounded local/AI support and provider policy remain in place; no new remote scheduler or automatic model escalation is added.

See `docs/plans/2026-09-27-guided-learning-sessions/design.md` and `docs/releases/2026-09-27-v0.5.4/VALIDATION.md`. Cache is `summer-quest-v105-guided-learning-sessions`. Both source and compiled modules are supplied.

```sh
npm run test:guided-session
npm run build:agent
npm run typecheck:mobile
npm run typecheck:agent
node --test scripts/*.test.mjs
node scripts/check.mjs
```

The historical v0.5.4 check retained 132 inherited findings; the recovery's required gate now passes. The optional rendered-component smoke test needs an already installed Python Playwright and Chromium: `python scripts/check-guided-session-ui.py --browser /path/to/chromium --out /path/to/test-output`. It uses real UI functions and bridges but is not a full-app, service-worker or hardware test. Live provider and actual tablet/offline acceptance remain pending.


## v0.5.5 — Bounded Explore Help (2026-09-27)

Science Lab, Map Explorer and Time Traveler Explore introductions now have **Explore with Summer / 跟 Summer 探索**. A local catalogue clue appears first; optional AI chooses an approved clue ID only. Listen and local Another clue do not require a model. No help is offered in Check or during questions.

The protected existing provider settings remain unchanged; there is no automatic escalation. One explicit help-selection attempt is allowed per stored Explore lesson session, separate from existing optional intro sequencing. Unknown usage stays unavailable in the adult telemetry view. No database/schema reset is needed.

Run `npm run test:knowledge-help`. See `docs/plans/2026-09-27-bounded-explore-help/design.md` and `docs/releases/2026-09-27-v0.5.5/VALIDATION.md` for scope, actual tests and remaining tablet/offline/live-provider acceptance.


### Bounded Check-mode help (v0.5.6)

Science, Geography and History **Check** questions now expose an explicit **Need a hint?** action before the child answers. The local runtime immediately provides one of three fixed bilingual strategy hints (remember the lesson, compare the choices, or rule one out), so help remains useful offline. One optional low-tier `knowledge_help` request may select among those already-approved strategies; it cannot generate child-facing prose.

The Check-help proxy projection deliberately withholds option labels, `correctOptionId`, explanations, selected answers, grading and mastery state. The model sees only the current question text plus the fixed strategy cue IDs/text. The answer, grading, mastery/review evidence, stars/rewards and question progression remain local and authoritative. Help is hidden as soon as an answer is committed, stale in-flight selections are discarded, and help state is removed before the next question. Attempt telemetry continues to record `hintsUsed: 0`, so this presentation support cannot change mastery calculations.

Explore help from v0.5.5 is unchanged. Cache is `summer-quest-v107-bounded-check-help`. Run `npm run test:knowledge-help` for the focused help gate. See `docs/releases/2026-09-29-v0.5.6/VALIDATION.md`.


### Tablet runtime hardening (v0.5.7)

This section records the historical prototype; the current recovery retires that child shell from product execution and distribution.

The child shell is now hardened for the tablet prototype before further learning-feature expansion. Ages **3–4 automatically use the existing pre-reader profile** unless an adult explicitly requests `?mode=reader`; this keeps assistant dialogue off, voice guidance on, text density at none and direct visual exploration available.

The mobile shell now tracks viewport/orientation, coarse-pointer, online/offline, display-mode and secure-context state. Coarse-pointer controls keep a 48px minimum target, 1024×768-style landscape tablets move the three-item navigation into a right rail, visual-viewport height drives the shell, and safe-area/contained-scroll rules reduce mobile-browser chrome and keyboard layout jumps. Returning from a backgrounded tab resumes an already-unlocked shared WebAudio context.

`START-SUMMER-QUEST.cmd` no longer requires an AI `.env`; local learning and LAN serving start without provider keys. In the historical v0.5.7 build the server still printed `/apps/kid/` tablet URLs; **v0.6.0 supersedes that route and serves the authoritative root `/index.html` instead**. Browser Service Workers still require a secure context, so plain HTTP LAN tablet sessions are online-session only; the Android package supplies its own local app bundle.

The historical offline cache was `summer-quest-v108-tablet-runtime-hardening`. Run `npm run test:tablet-runtime`, `npm run test:offline-shell`, or the full `node --test scripts/*.test.mjs` gate. See `docs/plans/2026-09-29-tablet-runtime-hardening/design.md` and `docs/releases/2026-09-29-v0.5.7/VALIDATION.md`.

### Unified runtime + Android repair (v0.6.0)

The thin Android boundary from v0.5.8 remains unchanged in authority: Capacitor/Java own only Back, lifecycle, haptics, Android TTS and audio focus. Learning, curriculum, grading, mastery, rewards, quests and AI policy remain shared TypeScript/web code. Capacitor stays pinned to 8.5.2.

`npm run build:android-web` now packages the real root Summer Quest runtime directly as `dist/android-web/index.html`. There is no `legacy.html`, no embedded app iframe and no second Android navigation shell. Games, books, Music Room, activities and learning therefore use the same state/navigation owner on web and Android. When private `js/config.js` is absent, the Android payload emits an empty local/offline stub and remote AI remains disabled.

v0.6.0 keeps the reproducible build/device gates and fixes the Windows setup defects found during the first physical install. `android:bootstrap` can spawn npm/npx command files correctly on Node 22+, Capacitor uses JSON config so TypeScript is not required just to generate Android, SDK discovery includes `local.properties` and the normal Windows SDK path, and the doctor now rejects JDK 25 for the pinned Gradle 8.14.3 toolchain (JDK 21–24 accepted). `npm run android:doctor:strict` checks the current unified Android bundle as well as Node, Java, SDK/platform 36, ADB, Capacitor, Gradle and optional device state. `npm run android:build:debug` performs a fresh sync, runs the generated Gradle wrapper, prints the APK SHA-256 and writes a local build report. Release APK/AAB tasks are also exposed without storing signing credentials.

Connected-tablet helpers provide device identity, installation, launch and a bounded process smoke check (`npm run android:device`, `android:install`, `android:smoke`). They intentionally do **not** toggle airplane mode, force rotation or silently change device settings. Real offline cold start, Back, rotation, haptics, TTS, audio focus and persistence are signed off with `apps/android/ACCEPTANCE-CHECKLIST.md`. Windows one-click wrappers mirror the same npm commands.

The web/PWA cache is `summer-quest-v110-unified-runtime`; the PWA manifest now starts at the root app.

### Miniature 3D World (v0.6.1 release)

The repaired v0.6.0 root runtime now owns the first real 3D exploration surface. Hero selection opens a miniature Three.js island with physical registry-backed destinations; drag/rotate and bounded pinch/zoom move the camera around the world. Quests, Games, Activities, Learning, Books, Music, Today and Rewards are represented as landmarks, while selected smaller props can open real content directly. The Classic hub remains a fallback and content opened from the world returns to that world through the same root navigation owner.

The Android payload contains 279 files and identifies itself as v0.6.1. PWA cache is `summer-quest-v111-miniature-world`. Run `npm run test:world` for the focused architecture/package gate and use `scripts/check-world-explorer-ui.py` plus `apps/android/ACCEPTANCE-CHECKLIST.md` for rendered/physical acceptance.
