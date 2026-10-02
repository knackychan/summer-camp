# v0.2.3 — Summer Interaction + Nudge UX

## Goal

Make the Quest-first child shell feel like a game companion rather than a dashboard, without giving the agent any additional authority over state.

## Interaction principles

1. **Summer has presentation state, not app authority.** Agent responses may select only an allow-listed emotion and animation token. The presenter maps those tokens to local CSS.
2. **Questions feel like game choices.** Energy and intent answers arrive as large, staggered touch cards with a tiny two-step progress cue.
3. **Quest cards have visual identity.** Care, help, learning, movement and play use different local accent treatments while preserving the shared component.
4. **Proactive does not mean interruptive.** A due routine may produce a small Summer nudge on the hub. While a game/activity is open, Summer only uses the companion badge and never covers gameplay.
5. **Coach, not cop.** Nudge copy says that a quest is ready and can be started when it fits; it never labels a child late or behind.
6. **Android-safe motion.** Short CSS animations are local, interruptible and disabled by `prefers-reduced-motion`. No animation state is required for correctness.

## New presenter boundary

`js/summer-ui.js` owns the visual mapping:

```text
structured Summer response
        ↓
SQSummerUI.normalize()
        ↓
allow-listed emotion + animation
        ↓
SQSummerUI.present()
        ↓
DOM text + data attributes + local CSS motion
```

Unknown model-controlled presentation values fall back to `happy` / `small_hop`.

## Proactive nudge rules

A nudge appears only when all are true:

- orchestrator has semantic attention (`routine_due` or `redo`);
- child is on the hub surface;
- no quest/companion overlay is open;
- that exact attention key has not been dismissed in the current UI session.

A nudge never appears over a game, book, music surface or activity detail.

## Visual changes

- Summer hero panel becomes a small character scene with expressive state.
- Structured emotions map to a fixed face/motion vocabulary.
- Two-step question meter clarifies the tiny recommendation flow.
- Choice cards animate in with short staggered timing.
- Quest categories share one card component with category accent variables.
- Upcoming routines are compact timeline-like items rather than plain chips.
- Bottom navigation has a stronger active-state pop while remaining coarse-pointer first.
- Companion attention uses a pulse/ring rather than modal interruption.
- Companion sheet and quest overlay receive the same rounded/tactile surface language.

## Accessibility / compatibility

- EN + Traditional Chinese remains mandatory for child-facing copy.
- `aria-live` is used for Summer/nudge status text.
- Reduced-motion disables the new decorative motion.
- No `color-mix()` dependency is used, keeping the styling safer for older Android WebViews.
- Touch interactions do not depend on hover.

## Verification

- `scripts/quest-agent.test.mjs`: pass
- `scripts/agent-orchestration.test.mjs`: pass
- `scripts/summer-ui.test.mjs`: pass
- Full `scripts/check.mjs`: same 132 failure lines as the untouched expanded handover baseline; no new gate regressions.

A real Chromium render was attempted, but this execution environment blocks browser navigation to localhost and `file://`, so visual-browser verification must be done in the canonical checkout/device environment.
