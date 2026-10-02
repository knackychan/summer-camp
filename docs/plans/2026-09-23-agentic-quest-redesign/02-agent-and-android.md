# Slice 02 — Agent provider + Android bridge

**Status:** implemented in v0.2.2 (protected provider remains optional; deterministic fallback stays authoritative offline).

## Goal

Replace the deterministic Summer provider with an optional protected remote LLM provider while preserving local fallback.

## Requirements

- no provider API key in `index.html`, `config.js`, APK or static assets;
- remote response is schema-constrained;
- remote provider receives only the filtered valid quest IDs and minimal context;
- local provider remains available offline and on errors;
- platform bridge can later be backed by Capacitor/native Android services;
- notification requests and background reminders are emitted as app intents rather than directly owned by the LLM.
