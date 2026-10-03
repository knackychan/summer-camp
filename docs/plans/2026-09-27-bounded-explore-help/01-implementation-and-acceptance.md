# Slice 01 — approved-content Explore clue selection

Baseline: `Summer-Quest-2026-09-27-v0.5.4-Guided-Learning-Sessions-FULL.zip`.

## Implemented boundaries

1. Canonical bilingual catalogue cues plus typed `knowledge_help` request/response/schema/prompt. Server-side canonicalization and ID validation reuse existing protected routing.
2. Presentation-only `KnowledgeHelpBridge` under the existing knowledge-store lock; local first, one explicit optional request, deadline/cancellation, persisted selection and reload recovery.
3. Existing root UI controls for Explore, highlighting, Listen and local Another clue; all question and Check paths protected.
4. Diagnostic-only telemetry and admin display with nullable metrics and separate bounded retention; existing grading/progress owners unchanged.
5. Cache v106, compiled modules, regression coverage and baseline-bound release packaging.

## DONE WHEN / actual status

- Local help without a provider and bilingual clues in all 18 catalogue lessons: PASS.
- Remote cue selection through client, fetch handler and protected proxy with deterministic test transport: PASS.
- Repeated taps, rerender/reload and local next do not repeat a help request: PASS.
- Check/question phases, wrong child/domain/lesson, old session and stale response cannot apply help: PASS.
- Invalid output, HTTP/provider failure, ignored cancellation and timeout leave local help usable: PASS.
- Requested unauthorized stronger profiles do not authorize themselves; explicit server-enabled manual override remains possible: PASS.
- Diagnostic null metrics and bounded retention do not manufacture free usage or displace graded evidence: PASS.
- Real rendered component controls at 768px and 390px, including delayed result and child switching: PASS.
- Full-page HTTP launch / real service-worker offline reload / physical tablet / live model: NOT VERIFIED (environment-dependent gates).

Run `npm run test:knowledge-help` for the focused gate. Run the two Python component scripts with Playwright and a locally installed Chromium for the rendered checks. The release validation report distinguishes those from full-app/device acceptance.
