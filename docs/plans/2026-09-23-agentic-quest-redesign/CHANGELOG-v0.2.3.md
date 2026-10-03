# Summer Quest v0.2.3 — Summer Interaction UX

Date: 2026-09-23

## Added

- `js/summer-ui.js` presentation boundary for allow-listed Summer emotion/motion state.
- Two-step energy/intent question meter and animated choice arrival.
- Proactive bilingual Summer nudge for due routines and redo requests.
- Hub-only nudge gating so games/activities are never covered by proactive prompts.
- Category-accented shared quest cards.
- Richer upcoming-routine presentation.
- Companion attention pulse and matching quest/companion surface styling.
- Reduced-motion handling for all new animations.
- `scripts/summer-ui.test.mjs`.

## Changed

- Summer home speech now goes through the presentation layer instead of assigning raw text alone.
- Companion replies use the same controlled presentation vocabulary.
- Bottom navigation active state receives game-like motion feedback.
- Service worker cache bumped to `summer-quest-v79-summer-interaction` and precaches `js/summer-ui.js`.

## Safety / architecture

- Agent still has no completion, reward or parent-approval authority.
- Unknown emotion/animation strings cannot become arbitrary CSS classes.
- Nudge wording stays invitational rather than punitive.
- No model/API credential was added to the client.

## Validation

All targeted Quest/Agent/UI tests pass. Full project gate produces the exact same 132 failure detail lines as the untouched expanded handover baseline.
