# P3 Captain View

Goal: ship the first P3 feature from `docs/SPEC.md`: Luis gets a captain view with read-only sibling progress and a helped-sibling claim that Papa can approve.

Scope:
- Add `help_claims` to Supabase schema with anon insert and authenticated review.
- Hydrate recent/today help claims in `SyncStore`, plus create/realtime helpers.
- Add a Luis-only Captain tab in the kid app.
- Add an admin approval queue; approval grants Luis +1 star through `stars_ledger`.
- Do not touch gameplay, mission data, or `docs/plans/2026-07-26-homework-lock-drills-outing`.

Done when:
- Luis can see Lucien/Lili today progress and submit a claim.
- Non-Luis kids do not see the Captain tab.
- Admin can approve/deny pending claims.
- `node scripts/check.mjs` and JS syntax checks pass.
