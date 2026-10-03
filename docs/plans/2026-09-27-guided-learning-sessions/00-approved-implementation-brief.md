# Summer Quest — v0.5.4 Unified Adaptive Tutor Orchestrator

**Date:** 2026-09-27  
**Status:** Proposed implementation brief — not an implemented or tested release  
**Intended baseline:** `Summer-Quest-2026-09-25-v0.5.3-History-Smart-Practice-FULL.zip`

## 1. Source basis and verification boundary

The attachment available for this planning pass is `Summer-Quest-2026-09-25-v0.5.3-History-Smart-Practice-SHA256.txt`. It lists the FULL archive, UPDATE archive, patch, plan, and changelog. The matching v0.5.3 source archive was not retrieved in this session. A checksum identifies the expected bytes; it does not supply or describe the implementation.

Expected SHA-256 of the FULL archive, copied from the supplied manifest:

```text
90ac72c32fddd17f957d285a59dc48038a65b73e231ea9afbfaf89e61a88a368
```

The baseline behavior below comes from the previous v0.5.3 conversation handoff, not a fresh code audit. The older `Summer-Quest-2026-09-23-v0.2.7-Multi-Provider-LLM-Routing-Plan.md` was also retrieved to confirm the recorded manual-first routing and privacy constraints. That historical plan is not evidence that a particular model or endpoint is currently available, or that its implementation remains unchanged.

The detailed scope, sequencing, defaults, and acceptance criteria in this document are proposals for the next implementation. Actual module paths, APIs, test commands, and migration requirements must be confirmed in the v0.5.3 checkout before editing. No application source was modified or tests executed in this planning pass.

## 2. Product outcome

Connect the existing learning activities into one guided learning session, using the existing interface.

The child should be able to start or resume learning, receive an appropriate next activity, complete it, and receive the next suggestion without having to understand the curriculum map or manually navigate between subjects. The session should respond to recorded evidence, while preserving the child's ability to choose another activity or stop.

The next release should coordinate Math, Language, Science, Geography, and History. It should not become a new content-expansion release, an unrestricted chatbot, or a redesign of the home screen.

Example acceptance scenario, not a fixed sequence for every child:

```text
Open existing learning entry
  → resume an unfinished session, or create a short session
  → choose an eligible activity from the existing Learning Director
  → launch the existing exercise or lesson
  → receive the existing locally validated result
  → update progress through the existing evidence pipeline
  → offer the next eligible activity, another choice, or finish
```

## 3. Preserve the v0.5.3 baseline

The prior handoff reports that:

- The six existing Time Traveler History lessons participate in the Curriculum Skill Map, Learning Director, Smart Practice, mastery, and spaced review.
- New/Building knowledge concepts launch in Explore mode. Secure/Review-due concepts launch in Check mode.
- History Check goes directly to its two locally graded questions, with AI resequencing disabled.
- `knowledgeMode` is the shared contract for Science, Geography, and History. `scienceMode` remains only a backward-compatible Science alias.
- Quick Placement remains Math + Language only.
- Learning Director schema is v11; older v10 daily plans rebuild locally.
- The previous broad checker result was 132 findings, unchanged from v0.5.2.

Verify these claims in the source and retain them as regression targets. Do not reimplement already shipped subject integration, silently extend placement to knowledge subjects, or reinterpret a completed lesson as proof of mastery.

Keep the existing UI. The 3D planet, native Android packaging, and a broader framework migration remain outside this slice. Preserve direct, low-reading exploration for younger children; the new guided session must not make AI questions mandatory.

## 4. Architecture boundary

**Extend the current Learning Director; do not introduce a competing scheduler.**

First inspect how much cross-subject selection and continuation already exists. Reuse those paths, and implement only the missing coordination. “Tutor Orchestrator” is a responsibility, not a requirement to add another independent service, framework, or duplicate state store.

| Existing responsibility | What the new coordination should do |
| --- | --- |
| Curriculum and activity registry | Request valid, age/level-compatible, launchable candidates. Do not invent activities or skills. |
| Learning Director | Reuse eligibility, priorities, daily-plan decisions, and any existing ranking. |
| Smart Practice and activity routing | Dispatch the selected skill through its existing launch contract. |
| Local grading and evidence pipeline | Consume validated outcomes; do not create a second grading or mastery path. |
| Mastery and spaced review | Read the updated state before the next recommendation. |
| Provider gateway | Request bounded optional tutor assistance under the existing server policy. |
| Current UI | Present start/resume, a short explanation, next/alternative/finish actions. |

Suggested coordination data, mapped onto existing types rather than blindly added as new fields: session identity, child scope, current activity reference, completed attempts, remaining session intent, recommendation reason, and a revision or equivalent stale-response guard.

## 5. Implementation order

### Step 1 — Verify the baseline and map integration points

Verify the FULL archive hash before extraction and use that checkout as the source of truth. Run the actual documented baseline gates and record their outputs before changing code.

Trace one complete existing launch and result flow for each subject. Locate candidate selection, launch parameters, completion events, evidence identifiers, persistence, child switching, service-worker registration, and provider task policies. Record where the new coordination can reuse those paths.

Identify the smallest supported change to the existing learning entry. Do not add a new home screen simply to host the orchestrator.

**Exit condition:** a concrete integration map and baseline results, with already implemented behavior explicitly excluded from duplicate work.

### Step 2 — Implement local next-activity coordination

Add a deterministic start/resume/next decision using the existing eligible candidates. Reuse existing ranking rather than replacing it merely to match this document.

Where ranking gaps actually exist, use explicit local inputs: due review, weak evidence, prerequisites, recent activities, the child's selected subject or intent, and any already supported session constraints. Avoid repetitive loops and unreasonable subject starvation, but do not force a five-subject rotation at the expense of prerequisites or the child's choice.

Every selected activity should have a stable, local reason, such as review due, practice needed, continue learning, or a child-selected activity. Human-readable text should be derived from approved templates where possible. Do not infer a child's emotions or attention state from one wrong answer; only use explicit choices or documented evidence signals.

Treat an empty candidate pool as a supported result: show an appropriate finish or exploration option rather than asking an LLM to invent an activity. Keep all decisions available without a network or provider key.

**Exit condition:** deterministic fixtures can select and launch an appropriate activity across all five subjects without making an LLM request.

### Step 3 — Close the session loop safely

Coordinate completion through the existing evidence pipeline, then refresh the next recommendation from the resulting learning state.

Reuse existing protections where present and add regression coverage for double taps, duplicate completion callbacks, refresh/resume, and stale results. A single attempt must not award progress or rewards twice. A cancelled or merely visited activity must not become a successful attempt. Persist the minimum session state needed to resume; do not duplicate the full student model or store unrestricted dialogue histories.

Scope sessions to the active child. Switching children, navigating away, or beginning another activity must invalidate stale asynchronous responses. Do not auto-launch the next activity while a child is still playing or when they have chosen to stop.

Use existing launch semantics: Explore/Check for the knowledge subjects and the current practice contracts for Math and Language. Do not force Math/Language into a knowledge-only contract.

**Exit condition:** start → launch → validated completion → progress update → next suggestion → finish/resume works end to end, including interruption cases.

### Step 4 — Add bounded, optional AI help

Keep local selection and local fallback authoritative. Reuse the provider-neutral gateway; do not create a parallel LLM client.

For the first integration, limit AI use to supported, bounded tutor tasks such as short child-facing phrasing or an Explore-mode explanation/hint grounded in approved lesson material. Reuse existing supported task classes when they fit. Begin with one useful task rather than enabling every possible tutor behavior simultaneously.

If the current gateway supports candidate ordering, any model suggestion must remain within the locally eligible candidate set, pass validation, and remain subordinate to hard local constraints. Introducing AI scheduling is not required to complete this release.

Preserve the recorded policy:

- Local deterministic behavior first; the configured inexpensive allowed profile only when AI adds value.
- Stronger profiles require explicit authorized adult/developer selection; no automatic escalation or child-authorized upgrade.
- Credentials and expensive-profile authorization remain server-side.
- Requests contain only the compact semantic context needed for the task, not the full family profile, complete history, or repository content.
- Invalid output, timeout, unavailable provider, or exhausted budget falls back locally without blocking learning or silently making a more expensive request.

AI must not change facts, answer keys, mastery, rewards, parent rules, or eligibility. It must not supply arbitrary HTML, JavaScript, or unapproved activity definitions.

Keep Check assessments protected: no AI resequencing or answer-bearing hint before the answer. Any help allowed by an existing assessment contract must preserve its assisted/unassisted evidence semantics. Explanations after a recorded answer must not retroactively change that evidence.

Record task, selected route, latency, fallback reason, and usage when returned. Record unavailable token/cost fields as unavailable, not zero. Do not hard-code new model names or claim a route is the cheapest market-wide without separate verification.

**Exit condition:** the session behaves correctly with AI enabled, disabled, invalid, delayed, and unavailable; the child client cannot authorize an expensive route.

### Step 5 — Expose the flow in the current interface

Use the existing learning entry and recommendation components. Add only the controls needed for the flow: start/resume, next suggestion, another choice, and finish.

Present one short reason for the recommendation. Keep technical diagnostics in an existing parent/debug surface rather than exposing internal identifiers to children. Useful diagnostics are subject, skill, mode, local selection reason, actual route/fallback, and whether the last result was recorded.

Maintain tablet-sized touch targets, normal back/exit behavior, and direct activity access. Preserve low-text exploration for pre-readers. Do not require chat, a reading-heavy setup, or new profile configuration to use existing activities.

**Exit condition:** the entire flow can be exercised through the current UI, without console commands or navigating the raw curriculum map.

### Step 6 — Validate migrations, offline behavior, and packaging

Preserve Learning Director v11 unless a genuine persisted-shape change requires a migration. Do not increment schemas or erase progress simply because the release number changes. A separate session schema is justified only if the implementation actually introduces independently persisted session data.

Update offline asset registration and the cache identifier as needed for the actual changed runtime files. Test first-load/update behavior, previously cached sessions, and resuming with no network. Do not assume a cache bump alone proves offline readiness.

Run focused tests plus all documented release gates. Compare broad-checker diagnostics by identity, not only total count: “132 before / 132 after” can still conceal one new regression replacing one old finding. Explicitly document any intentionally resolved inherited finding.

**Exit condition:** an auditable release with real test results, no unaccounted new findings, and exact reconstruction checks for update artifacts.

## 6. Minimum acceptance matrix

| Scenario | Required result |
| --- | --- |
| AI disabled or no provider key | Start, complete, continue, and finish a session locally. |
| Each of the five subjects | A valid candidate launches through the existing subject runtime. |
| New/Building knowledge skill | Existing Explore behavior is preserved. |
| Secure/Review-due knowledge skill | Existing Check behavior and local grading are preserved. |
| History Check | Two local questions; no AI resequencing. |
| Weak evidence or missed review | The next decision respects the existing mastery/review rules. |
| Missing prerequisite or unavailable activity | Candidate is excluded before optional AI involvement. |
| No eligible activity | Supported finish/exploration fallback; no invented content. |
| Child chooses another activity or stops | Choice is respected; no forced launch or fabricated failure. |
| Double tap or repeated completion event | At most one progress/reward effect per attempt. |
| Refresh or resume | No replayed reward, cross-child leakage, or lost committed result. |
| Child switch or navigation during AI request | Stale output cannot alter the current session. |
| Invalid, delayed, or unavailable AI response | Immediate usable local path; no automatic paid escalation. |
| Unapproved model/profile request | Rejected or handled by existing allowed default policy on the server. |
| Check-mode tutor assistance | No leaked answer or falsely unassisted assessment evidence. |
| Existing v10/v11 learning data | Established migration behavior and accumulated progress remain intact. |
| Offline update and relaunch | Required runtime assets are available and the local session works. |
| Existing Quick Placement | Remains Math + Language. |
| Pre-reader/direct exploration | Remains accessible without AI questioning or mandatory reading. |
| Regression gates | Actual outputs recorded; no unaccounted new findings. |

## 7. Suggested development checkpoints

Implement these as checkpoints inside the v0.5.4 work, not promises of additional shipped versions:

**Checkpoint A — Local orchestration.** Next-activity decision, existing launch adapters, completion, resume, and focused tests. This must work without AI.

**Checkpoint B — Bounded tutoring.** One supported optional AI help task, allow-list enforcement, minimal context, usage reporting, and robust local fallback.

**Checkpoint C — Integration and release.** Current-UI entry/continuation, offline and migration tests, complete regression report, and reproducible packaging.

This ordering provides a useful learning flow before introducing remote-provider failure modes and cost.

## 8. Deliverables for the actual implementation

Produce the full v0.5.4 source archive, an explicitly baseline-bound UPDATE archive, a patch, updated plan and changelog, validation results, and SHA-256 manifest, following the existing release convention.

The release notes must distinguish implemented behavior, tested behavior, untested environment-dependent behavior, and deferred work. Include an explicit changed/new/deleted file manifest and verify that both UPDATE application and patch application reconstruct the intended final checkout. Do not assert that tests pass from remembered counts.

Do not bundle credentials, private runtime data, or unrelated projects. Do not reconstruct the baseline from old v0.2.x patches when the v0.5.3 FULL archive is the intended source of truth.

## 9. Required implementation input

Attach `Summer-Quest-2026-09-25-v0.5.3-History-Smart-Practice-FULL.zip`. The checksum manifest is already available. The separate v0.5.3 plan and changelog are helpful if absent from the archive, but they are not substitutes for source code.

If a deliberately edited checkout has superseded that release, its actual current archive must be identified as the implementation baseline instead; do not silently overwrite those changes to satisfy the old checksum.
