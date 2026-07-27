# Vendored Three.js

- **Version:** 0.185.1
- **Date:** 2026-07-27
- **Sources:**
  - `three.module.min.js` — https://unpkg.com/three@0.185.1/build/three.module.min.js
  - `OrbitControls.js` — https://unpkg.com/three@0.185.1/examples/jsm/controls/OrbitControls.js
- **Patch applied:** `OrbitControls.js` line 12: bare specifier `'three'` rewritten to `'./three.module.min.js'` so the module works without import maps.
- **Version policy per solar-system design D7:** latest stable; Android 8 baseline retired 2026-07-27.
- **WebGL2 probe on tablet: human checkpoint — await result.**
