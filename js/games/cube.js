/* Spinning-cube proof — dev-flag seam probe (slice 21).
   Never in the games grid, never in the manifest. Lazily loaded only
   when location.hash === "#devcube" (main.js). Stays as permanent
   probe file per project non-negotiable (never delete project files). */

import { loadThree, createRenderer, releaseContext, firstFrame, observeResize } from "./three-runtime.js";

var R = null, initToken = 0;

function pauseOnHidden() {
  function onVis() {
    if (!R) return;
    if (document.hidden) {
      cancelAnimationFrame(R.raf);
      R.raf = null;
    } else if(!R.raf) {
      R.timer.reset();
      R.raf = requestAnimationFrame(tick);
    }
  }
  document.addEventListener("visibilitychange", onVis);
  return function () { document.removeEventListener("visibilitychange", onVis); };
}

function tick() {
  if (!R) return;
  if(R.renderer.getContext().isContextLost()||R.renderer.sqGraphicsError){R.raf=requestAnimationFrame(tick);return;}
  R.timer.update();
  var dt = Math.min(R.timer.getDelta(), 0.1);
  R.cube.rotation.x += 0.4 * dt;
  R.cube.rotation.y += 0.6 * dt;
  R.renderer.render(R.scene, R.camera);
  R.raf = requestAnimationFrame(tick);
}

function dispose(obj) {
  if (!obj) return;
  if (obj.traverse) {
    obj.traverse(function (child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function (m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    });
  }
}

export default {
  id: "cube",
  meta: { icon: "\ud83e\uddea", title: "Cube", tz: "\u65b9\u584a", blurb: "dev probe" },
  keyboard: false,
  bestKey: null,

  async init(ctx) {
    var token=++initToken;
    await Promise.resolve();
    if(token!==initToken)return;
    var runtime=await loadThree(document.createElement("canvas"));
    if(token!==initToken){releaseContext(runtime);return;}
    var THREE=runtime.THREE;
    R = {};
    R.THREE = THREE;

    var mount = ctx.mount;
    if (!mount.style.position || mount.style.position === "static") {
      mount.style.position = "relative";
    }
    mount.innerHTML = "";

    var canvas = runtime.canvas;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    mount.appendChild(canvas);

    R.renderer = createRenderer(runtime,2);
    R.renderer.setClearColor(0x191340);
    var initialW = Math.max(mount.clientWidth || 640, 1);
    var initialH = Math.max(mount.clientHeight || 320, 1);
    R.renderer.setSize(initialW, initialH, false);

    R.scene = new THREE.Scene();
    R.camera = new THREE.PerspectiveCamera(45, initialW / initialH, 0.1, 100);
    R.camera.position.set(3, 2, 5);
    R.camera.lookAt(0, 0, 0);

    R.scene.add(new THREE.AmbientLight(0xA79FD6, 0.55));
    var dir = new THREE.DirectionalLight(0xFFF4D6, 1.1);
    dir.position.set(2, 4, 3);
    R.scene.add(dir);

    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshLambertMaterial({ color: 0xFFC93C });
    R.cube = new THREE.Mesh(geo, mat);
    R.scene.add(R.cube);

    R.timer = new THREE.Timer();
    R.resize = function () {
      var w = Math.max(mount.clientWidth || 640, 1);
      var h = Math.max(mount.clientHeight || 320, 1);
      R.renderer.setSize(w, h, false);
      R.camera.aspect = w / Math.max(h, 1);
      R.camera.updateProjectionMatrix();
    };
    R.ro = observeResize(mount,R.resize);

    R.unpause = pauseOnHidden();
    firstFrame(R.renderer,R.scene,R.camera);
    R.raf = requestAnimationFrame(tick);
  },

  stop() {
    initToken++;
    if (!R) return;
    if (R.raf) { cancelAnimationFrame(R.raf); R.raf = null; }
    if (R.unpause) { R.unpause(); R.unpause = null; }
    if (R.ro) { R.ro.disconnect(); R.ro = null; }
    if (R.resize) { R.resize = null; }
    dispose(R.cube);
    dispose(R.scene);
    if (R.renderer) {
      R.renderer.dispose();
      var canvas = R.renderer.domElement;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      try { R.renderer.forceContextLoss(); } catch (e) {}
      R.renderer = null;
    }
    R.cube = null;
    R.scene = null;
    R.camera = null;
    if (R.timer) { R.timer.dispose(); R.timer = null; }
    R = null;
  }
};
