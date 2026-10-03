# Kitchen Quest in Summer Quest

Requested by Papa, 2026-10-03: integrate local Kitchen-Quest-v0.6.0 and adapt it to the shared pixel art game. Implementation follows that request.

- Reuse the source game's deterministic domain model: two independent customer plates, ordered recipes, finite stock, direct patty cooking, chopping, lasagna, easy and standard modes. Port its TypeScript to browser ES modules; no new dependencies or iframe.
- A native registry game uses the existing host, access checks, Back navigation, sound and best-score persistence. Score is orders served in a shift; no new star awards. Dishes remain session-only, as in the source.
- Draw the diner and food in code with Pixel Planet's existing palette. Use bilingual English / Traditional Chinese controls, touch targets and keyboard equivalents. Pause cooking during backgrounding, manual pause and mode confirmation.
- Register one diner landmark and cache every new runtime file for offline/PWA/Android builds.
- The standalone source's developer-only feel lab and audio synthesis controls are outside this integration; the app's shared sound controls apply.

See [implementation and validation](01-integration.md).
