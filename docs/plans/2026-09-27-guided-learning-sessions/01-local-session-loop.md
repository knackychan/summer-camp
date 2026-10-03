# Slice 01 — Local session loop and bounded-assistance integration

Status: implemented and automated checks passing; physical-device acceptance pending.

## DONE WHEN — verified

- The existing Director remains the only scheduler and all five subjects can launch through their existing runtime.
- Validated run-bound unique evidence advances the active step; unrelated/stale/duplicate evidence does not.
- Pause/resume retains committed progress; finishing early does not mark unfinished work complete.
- Alternatives and availability fallback never silently launch or fabricate completion.
- Subject Check/Explore, v11 migration, placement boundaries and provider restrictions retain their regression coverage.
- Local builds/type checks and all discovered tests pass; broad checker diagnostic identities match the inherited baseline.
- FULL, UPDATE and patch reconstruct the same output tree (release-packaging validation).

## DONE WHEN — still requires external acceptance

- Launch the complete app over HTTP on the target tablet; perform Start → two items → return → Next.
- Pause partway, reload the page, resume, and verify no extra stars or duplicated evidence.
- Switch children during loading; ensure neither the view nor the launched activity belongs to the other child.
- Warm the service worker on localhost/HTTPS, reload offline and complete a guided lesson.
- Confirm configured provider outage still permits local help, then make one authorized live-provider request and observe latency/cost.

See the release validation report for reproducible commands and the exact boundary of the rendered-component smoke test.
