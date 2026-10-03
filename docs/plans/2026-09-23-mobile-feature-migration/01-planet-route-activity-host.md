# Slice 01 — Planet routing + activity host

## Scope

- promote mobile shell through manifest start URL;
- add data-driven world zones;
- route Zone, Quest Detail and Activity screens;
- add typed legacy section adapters;
- host legacy surfaces inside the mobile shell;
- preserve offline PWA behavior;
- preserve pre-reader icon/audio navigation.

## DONE WHEN

- strict TypeScript passes;
- mobile architecture tests pass;
- PWA manifest starts on `apps/kid/index.html`;
- mobile navigation has a dedicated offline fallback;
- a legacy activity returns an embedded launch target rather than navigating the entire app away;
- Planet zone state is derived from current quest/activity availability;
- Android back can unwind Activity -> Zone -> Planet;
- legacy full-project gate does not gain new failures compared with the v0.2.5 baseline.
