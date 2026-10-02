# v0.5.4 — Unified Adaptive Tutor Orchestrator: guided learning sessions

Date: 2026-09-27
Status: implemented local coordination slice; scope approved by the user's “ok next” and subsequent source-archive upload. Release acceptance on physical tablets and live providers remains pending.
Baseline: Summer-Quest-2026-09-25-v0.5.3-History-Smart-Practice-FULL.zip
Baseline SHA256: 90ac72c32fddd17f957d285a59dc48038a65b73e231ea9afbfaf89e61a88a368

## Product outcome

The existing Learn → Smart Practice card supports Start, Resume, Another choice, Pause and Finish for now. After an existing activity records its validated result, the existing Learning Director refreshes the evidence and proposes the next eligible activity. It does not automatically start that activity. Math, Language, Science, Geography and History share this coordination path.

The original plan already selected across subjects. This release extends that plan and its bridge rather than adding a competing scheduler, new curriculum, generic chatbot or planet UI. Age/prerequisite gates, target practice counts, teach scenes and the underlying subject runtimes remain the starting point. A session need not include all five subjects.

## Verified integration map

| Responsibility | Implementation |
| --- | --- |
| Eligibility, launch contract, local next-step recommendation | packages/learning/src/director/LearningDirector.ts |
| Serialized session actions, storage and stale-action checks | packages/learning/src/legacy/LearningDirectorBridge.ts |
| Existing browser entry/facade | js/learning-runtime.js; Learn section in index.html |
| Math result validation | BrainMathLearningBridge.ts; existing Brain Gym host callbacks |
| Language result validation | VocabularyLearningBridge.ts; js/games/vocab.js |
| Fixed-content knowledge lessons and two local questions | KnowledgeLessonBridge.ts; KnowledgeLessonRuntime.ts |
| Canonical local attempt evidence and summaries | LearningTelemetry.ts; existing mastery/review consumers |
| Optional existing AI hints, teach wording and Explore sequencing | Existing agent client/service/server boundary, not a new remote task |
| In-process local read/modify/write serialization | packages/storage/src/SerialStorageTasks.ts |

## Coordination contract

The existing v11 daily-plan schema and storage key stay in place. A lazily added `coordination` object (version 1) records ready/running/paused/finished, revision and declined skills. No new database table, server endpoint, separate session database or compulsory data reset is introduced.

The shipped UI opts in with `guided: true`. Already coordinated plans stay coordinated; old non-opted-in bridge clients retain their legacy behavior. Existing completed v11 steps and committed partial counts survive the upgrade. Incomplete legacy starts are reopened without trusting unbound historical events. The previous v10-to-v11 rebuild behavior remains.

Each launched activity has a new run identity. Guided progress requires matching learner, domain, skill, run and unique event identity. Math and Language store stable attempt IDs and deduplicate repeated callbacks; Knowledge answers use deterministic session/question IDs. Valid free practice still contributes to ordinary learning evidence but cannot satisfy the active guided run. A wrong but locally validated answer can finish a practice item; this is not a claim of mastery or success on that question.

Accepted guided progress is saved on the step, so trimming the bounded telemetry buffer does not undo committed partial progress. The next recommendation uses current summaries and the existing eligibility/ranking helpers only at safe boundaries, not to reshuffle an active exercise. Another choice changes the current recommendation, retaining the completed prefix and the underlying practice evidence. A newly unavailable activity yields an eligible unstarted replacement or an honest no-candidate state, not invented completion.

Finish for now is a voluntary stop, distinct from completing every planned step. Pause closes the run and preserves progress; resume assigns a fresh run identity. Knowledge resume also retains the current question, committed answers and local lesson state. Returning from a Math/Language game waits for pending local learning writes before pausing or rendering progress. It never waits for a remote model request.

Expected plan/step/revision checks and per-learner serialization reject stale actions. UI tokens prevent delayed callbacks from painting or launching on another child or view. These are local lifecycle controls, **not an authentication mechanism or a cross-tab/distributed transaction guarantee**.

## AI and assessment boundary

No new LLM scheduler, provider task, profile, autonomous escalation or pricing assumption is introduced. The existing protected gateway and manually configured routing policy remain unchanged. Existing local hints/teach visuals remain usable without providers; optional AI wording and approved Explore sequencing use their existing allow-lists.

Teach and vocabulary callbacks verify their current child/step/word before painting. Knowledge adaptation is claimed once, runs outside the local storage lock, and can apply only to the same unadvanced intro revision. A delayed response cannot resurrect a reset/replaced lesson, erase an answer or reorder a Check. Check mode stays local and AI-free; History still has exactly two locally graded questions. `knowledgeMode` remains shared across the three knowledge subjects and `scienceMode` remains the compatibility alias. Quick Placement stays Math + Language only.

The new work hardens existing assistance; it is not a new conversational tutor experience, and no live-provider quality evaluation was run.

## Interface and offline shell

Keep the current Learn screen, existing activities, theme and free exploration. The skill map is collapsed under a disclosure to keep the primary next action visible. New controls and states are bilingual EN + Traditional Chinese with touch-sized buttons. Paused guided knowledge lessons do not trap the child in a disabled topic list.

Service-worker cache: `summer-quest-v105-guided-learning-sessions`.
The new compiled storage helper is included in APP_SHELL. Compiled mobile modules are shipped. Browser service-worker installation/airplane-mode reload remains a manual acceptance item; component rendering is not evidence of that behavior.

## Validation and remaining work

See ../../releases/2026-09-27-v0.5.4/VALIDATION.md for actual results and limitations. The local logic, all subject adapters and component-level History session journey have been tested. Desktop full-app HTTP navigation was blocked by the execution environment; native Android, real hardware/back/background behavior, live API wording/latency/budget, LAN multi-device conflicts and a real service-worker offline reload are not certified by this release.

Do not resume planet redesign or extend Quick Placement in this slice. Next acceptance checkpoint is the existing app on the target tablet, followed by an explicit authorized provider smoke test and cost/latency observation. Further UI/agent expansion should use the results of those checks rather than add another state owner.
