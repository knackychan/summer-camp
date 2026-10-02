# v0.5.5 — Bounded Explore Help

Date: 2026-09-27. Implementation scope under the user's “ok go” continuation of the v0.5.4 guided-learning release. This is the bounded tutoring checkpoint left after local orchestration, not a new UI or a second learning scheduler.

## Child experience

In the existing Science Lab, Map Explorer or Time Traveler Explore introduction, tap **Explore with Summer / 跟 Summer 探索**. A local bilingual observation appears immediately after local storage completes. An optional model request can select one approved clue from the current lesson; it cannot write the clue. The chosen visual/fact is highlighted. Listen uses the existing browser speech function; Another clue cycles locally. Questions, Pause and topic navigation remain available throughout.

No chat input is introduced. Pre-readers retain visual-first local help and direct exploration. Help is unavailable throughout Check mode and throughout the question phase, including answered questions. The existing post-answer explanation is unchanged.

## Factual boundary

`KnowledgeHelpContract.ts` projects visual notes and facts from the existing Science, Geography and History catalogues into immutable bilingual cues. The new `knowledge_help` model response is only `{kind, cueId}`. The client resolves text from the catalogue. The server reconstructs the cue list from its own same-version catalogue instead of trusting submitted text, rejects a wrong stage/mode/phase/domain/lesson, and rejects a returned ID outside that lesson. No curriculum text, answer key, question, reward or grading decision can be authored by this task.

The request has the lesson/domain, age band, reading level, optional inspected visual ID and catalogue cues. It has no learner identifier, answers, full profile, household/routine data, chat history or director state. The server does not attest a browser's actual session phase; it enforces the task's request contract. Phase and current-session checks in the trusted application protect the child flow. This is not anti-tamper protection against an owner modifying their local app.

## Ownership and persistence

The existing KnowledgeLessonStore and its per-learner serial-storage lock own the optional `session.help` record. The existing session version remains 1 and Learning Director remains v11. No new database or independent scheduler is added. Help has its own revision; it does not bump the assessment `updatedAt` guard, change a plan, write an answer, award stars, change mastery or complete a guided step.

Opening help returns local data first. A separate explicit method claims at most one remote help selection for that stored Explore lesson session. Reopening, rerendering, reloading and Another clue cannot repeat it. An explicit new lesson session resets this allowance; it is not a family-wide spend quota. The older optional lesson-sequencing call remains unchanged and is not included in this one-help-selection allowance.

A six-second help deadline races even an adapter that ignores cancellation. The HTTP client receives an AbortSignal. Leaving the view, switching children, listening to a clue, moving to another clue/observation, starting questions or resetting the lesson invalidates/cancels pending help. A local cancel/next that wins before the claim consumes the help allowance, preventing a delayed claim from starting later. A pending record found after a bridge reload returns to local help without retrying. Aborting a client does not guarantee the provider stops work or bills nothing.

Responses must still match the learner, domain, lesson session, Explore/intro phase, help revision and director run. They cannot resurrect a deleted/replaced lesson, undo an answer or overwrite a newer local selection. Local serialization does not implement cross-device/distributed exactly-once semantics.

## Routing and diagnostics

Reuse the protected existing gateway, adapters and manual profile policy. Model names, prices, profile defaults, environment example and client configuration example are unchanged. No automatic upgrade, paid retry or live provider call is introduced by the implementation work. Catalogue pricing is inherited planning data, not newly verified current pricing.

A new `tutor_help` event records task, lesson, source, applied/discarded outcome, fallback reason, latency, returned route and optional token/cost metrics. It is not a learning hint or attempt. Unknown usage is `null`, displayed as Unavailable, never manufactured as zero. Invalid/non-numeric provider counters cannot create a zero-cost estimate. The existing admin telemetry view displays the last 40 help records and exports them through its normal JSON export.

Operational help records have their own last-100 retention allowance in the existing telemetry store and optional family-PC collector. They cannot displace the existing learning-evidence allowance. Summaries exclude them from mastery/support/hint calculations. No raw model error, prompt or response prose is stored in these records. The telemetry mirror still uses the existing optional family-PC configuration.

## Out of scope

No planet UI, new subject, free-form chatbot or explanation generator, exercise authoring, server-authoritative learner identity, distributed spending budget, provider pricing review, automatic model escalation, native Android lifecycle change, or expansion of Quick Placement. No Math/Language exercise or gameplay change. Physical-device, real offline lifecycle and live-provider acceptance remain manual gates.
