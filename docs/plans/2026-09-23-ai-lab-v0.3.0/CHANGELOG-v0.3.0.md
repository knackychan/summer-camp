# Summer Quest v0.3.0 — AI Lab

## Added

- Operations → AI Lab route using the existing admin shell;
- shared typed lesson-hint evaluation request/runtime;
- manual side-by-side provider/model profile comparison;
- requested-vs-actual profile verification;
- latency, token and estimated-cost display;
- validated JSON inspection;
- offline/no-endpoint status without breaking the admin UI;
- focused `test:ai-eval` coverage;
- service-worker cache entries for the evaluator runtime.

## Policy

No automatic escalation is introduced. The protected server allow-list remains authoritative, and ordinary child-facing production should keep client profile override disabled.
