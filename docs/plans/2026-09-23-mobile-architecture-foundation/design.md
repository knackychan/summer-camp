# Mobile Architecture Foundation — approved direction

Date: 2026-09-23
Milestone: v0.2.5

## Decision

Summer Quest will evolve through a strangler migration rather than a full rewrite.

The target product language is TypeScript. Android will use a thin native/Capacitor shell for device capabilities, while the Quest Engine, Learning Runtime, Student Model, agent orchestration and games remain portable.

## v0.2.5 boundary

This milestone introduces, without replacing the legacy child app:

- `apps/kid/` — a new mobile-first child shell;
- `packages/` — framework-independent domain/platform packages;
- a typed navigation stack;
- typed storage and platform boundaries;
- a legacy Quest adapter;
- an Activity Registry with Brain Gym as the first legacy activity adapter;
- an initial visual Planet Home proving the future navigation model;
- pre-reader capability at the shell level;
- a TypeScript compile/test pipeline;
- a Capacitor-ready Android boundary without adding native dependencies yet.

## Compatibility rule

Legacy `window.SQ*` services remain authoritative until their replacement package is proven and migrated. New code reaches them only through explicitly named legacy adapters.

No new domain behavior should be added to `index.html` as part of this migration.
