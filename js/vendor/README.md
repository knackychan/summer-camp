# Vendored Three.js

- **Version:** 0.185.1
- **Date:** 2026-07-27
- **Sources:**
  - `three.module.min.js` — https://unpkg.com/three@0.185.1/build/three.module.min.js
  - `three.core.min.js` — https://unpkg.com/three@0.185.1/build/three.core.min.js
  - `OrbitControls.js` — https://unpkg.com/three@0.185.1/examples/jsm/controls/OrbitControls.js
- **Patch applied:** `OrbitControls.js` line 12: bare specifier `'three'` rewritten to `'./three.module.min.js'` so the module works without import maps.
- **Version policy:** r185 remains the WebGL2 renderer. The user's Android 8 request on 2026-10-03 supersedes the retired-device constraint in solar-system design D7.

## WebGL1 fallback (Android 8 compatibility)

`three-legacy/` is pinned to **r162 / 0.162.0**, the final Three.js release with WebGL1 support. `js/games/three-runtime.js` imports it only when the actual WebGL2 context cannot start. Modern devices keep r185. All fallback code is included in the offline cache.

Official sources from the immutable release tag:

- [three.module.min.js](https://raw.githubusercontent.com/mrdoob/three.js/r162/build/three.module.min.js)
- [OrbitControls.js](https://raw.githubusercontent.com/mrdoob/three.js/r162/examples/jsm/controls/OrbitControls.js)
- [Timer.js](https://raw.githubusercontent.com/mrdoob/three.js/r162/examples/jsm/misc/Timer.js)
- [MIT license](https://raw.githubusercontent.com/mrdoob/three.js/r162/LICENSE)

OrbitControls' bare `three` import is rewritten to `./three.module.min.js`; renderer and Timer code are unchanged. Chrome 138 browser checks exercise both engines, rendering, context recovery, failed launches and offline playback. Physical Android 8 GPU validation remains pending.
