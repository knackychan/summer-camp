/* Spinning-cube proof — dev-flag seam probe (slice 21).
   Never in the games grid, never in the manifest. Lazily loaded only
   when location.hash === "#devcube" (main.js). Stays as permanent
   probe file per project non-negotiable (never delete project files). */

var R = null;

function pauseOnHidden() {
  function onVis() {
    if (!R || !R.raf) return;
    if (document.hidden) {
      cancelAnimationFrame(R.raf);
      R.raf = null;
    } else {
      R.clock.start();
      R.raf = requestAnimationFrame(tick);
    }
  }
  document.addEventListener("visibilitychange", onVis);
  return function () { document.removeEventListener("visibilitychange", onVis); };
}

function tick() {
  if (!R) return;
  var dt = Math.min(R.clock.getDelta(), 0.1);
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
    var THREE = await import("../vendor/three.module.min.js");
    R = {};
    R.THREE = THREE;

    var mount = ctx.mount;
    if (!mount.style.position || mount.style.position === "static") {
      mount.style.position = "relative";
    }

    var canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    mount.appendChild(canvas);

    R.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    R.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.renderer.setClearColor(0x191340);
    canvas.width = mount.clientWidth;
    canvas.height = mount.clientHeight;

    R.scene = new THREE.Scene();
    R.camera = new THREE.PerspectiveCamera(45, canvas.width / Math.max(canvas.height, 1), 0.1, 100);
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

    R.clock = new THREE.Clock();
    R.resize = function () {
      var w = mount.clientWidth;
      var h = mount.clientHeight;
      canvas.width = w;
      canvas.height = h;
      R.renderer.setSize(w, h, false);
      R.camera.aspect = w / Math.max(h, 1);
      R.camera.updateProjectionMatrix();
    };
    R.ro = new ResizeObserver(function () { R.resize(); });
    R.ro.observe(mount);

    R.unpause = pauseOnHidden();
    R.raf = requestAnimationFrame(tick);
  },

  stop() {
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
    R.clock = null;
    R = null;
  }
};
