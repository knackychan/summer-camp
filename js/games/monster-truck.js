/* Monster Truck Arena

THESIS: A low-poly toy arena where the joy is physical: climb dirt hills, land
hard, and smash little cars into colorful chunks. It refuses menu-heavy racing.
OWN-WORLD: Saturated fairground dirt, painted barriers, chunky poly models,
big icon controls, and toy-like debris that bounces visibly inside the stage.
STORY: Drive the monster truck, chase AI cars, crush them, and try to set a best.
FIRST VIEWPORT: Full-stage 3D arena with the truck centered, controls at the
bottom, mission prompt at top, and rolling cars already moving in view.
FORM: Existing Summer Quest arcade extension; no new visual identity. */

var R = null;

export var meta = {
  icon: "\ud83d\udede\ufe0f",
  title: "Monster Truck",
  tz: "\u602a\u7378\u5361\u8eca",
  blurb: "Crush cars in 3D \u00b7 3D\u58d3\u8eca"
};

var ARENA = 42;
var HALF = ARENA / 2;
var CAR_COUNT = 8;
var MAX_DEBRIS = 90;
var TRUCK_RADIUS = 2.1;
var CAR_RADIUS = 1.25;

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function lerp(a, b, t) { return a + (b - a) * t; }

function groundHeight(x, z) {
  var h = 0;
  h = Math.max(h, rampHeight(x, z, -10, -3, 8, 6, 2.7, "x"));
  h = Math.max(h, rampHeight(x, z, 9, 6, 9, 7, 3.4, "z"));
  h = Math.max(h, moundHeight(x, z, -2, 11, 5.5, 2.2));
  h = Math.max(h, moundHeight(x, z, 13, -9, 4.5, 1.7));
  h = Math.max(h, bermHeight(x, z));
  return h;
}

function rampHeight(x, z, cx, cz, w, d, h, axis) {
  var dx = Math.abs(x - cx), dz = Math.abs(z - cz);
  if (dx > w / 2 || dz > d / 2) return 0;
  var along = axis === "x" ? (x - cx) / (w / 2) : (z - cz) / (d / 2);
  var cross = axis === "x" ? dz / (d / 2) : dx / (w / 2);
  return Math.max(0, h * (1 - Math.abs(along)) * (1 - cross * 0.25));
}

function moundHeight(x, z, cx, cz, r, h) {
  var d = Math.hypot(x - cx, z - cz) / r;
  if (d >= 1) return 0;
  return h * (1 + Math.cos(d * Math.PI)) * 0.5;
}

function bermHeight(x, z) {
  var edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge < HALF - 4.5) return 0;
  return clamp((edge - (HALF - 4.5)) / 4.5, 0, 1) * 1.25;
}

function groundPitch(x, z, h) {
  var front = groundHeight(x + Math.cos(h) * 1.5, z + Math.sin(h) * 1.5);
  var back = groundHeight(x - Math.cos(h) * 1.5, z - Math.sin(h) * 1.5);
  return clamp((back - front) * 0.32, -0.45, 0.45);
}

function groundRoll(x, z, h) {
  var lx = x + Math.cos(h + Math.PI / 2) * 1.25;
  var lz = z + Math.sin(h + Math.PI / 2) * 1.25;
  var rx = x + Math.cos(h - Math.PI / 2) * 1.25;
  var rz = z + Math.sin(h - Math.PI / 2) * 1.25;
  return clamp((groundHeight(rx, rz) - groundHeight(lx, lz)) * 0.26, -0.4, 0.4);
}

function addStyle(css) {
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

function material(THREE, color, roughness) {
  return new THREE.MeshLambertMaterial({ color: color, flatShading: true });
}

function box(THREE, w, h, d, mat, x, y, z) {
  var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x || 0, y || 0, z || 0);
  return mesh;
}

function cylinder(THREE, r1, r2, h, seg, mat) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 8), mat);
}

function addShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeTruck(THREE, mats) {
  var truck = new THREE.Group();
  var chassis = box(THREE, 3.8, 0.55, 2.1, mats.truckDark, 0, 0.95, 0);
  var body = box(THREE, 3.2, 1.0, 1.75, mats.truckBlue, 0.05, 1.5, 0);
  var cab = box(THREE, 1.35, 1.05, 1.55, mats.truckYellow, -0.55, 2.2, 0);
  var hood = box(THREE, 1.35, 0.62, 1.65, mats.truckRed, 1.1, 1.95, 0);
  truck.add(addShadow(chassis), addShadow(body), addShadow(cab), addShadow(hood));

  var windowMat = mats.window;
  truck.add(addShadow(box(THREE, 0.08, 0.52, 1.05, windowMat, -1.25, 2.27, 0)));
  truck.add(addShadow(box(THREE, 0.5, 0.42, 0.08, windowMat, -0.35, 2.32, 0.81)));
  truck.add(addShadow(box(THREE, 0.5, 0.42, 0.08, windowMat, -0.35, 2.32, -0.81)));

  var wheelMat = mats.tire;
  var hubMat = mats.hub;
  var offsets = [[-1.35, 0.82], [1.35, 0.82], [-1.35, -0.82], [1.35, -0.82]];
  truck.userData.wheels = [];
  offsets.forEach(function (o) {
    var wheel = cylinder(THREE, 0.62, 0.62, 0.58, 12, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(o[0], 0.7, o[1]);
    var hub = cylinder(THREE, 0.28, 0.28, 0.62, 8, hubMat);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    truck.userData.wheels.push(wheel);
    truck.add(addShadow(wheel));
  });

  var exhaust = cylinder(THREE, 0.08, 0.08, 1.4, 8, mats.metal);
  exhaust.position.set(-1.45, 2.3, -0.95);
  truck.add(addShadow(exhaust));
  return truck;
}

function makeCar(THREE, mats, color) {
  var g = new THREE.Group();
  var carMat = material(THREE, color);
  var dark = mats.tire;
  g.userData.carMat = carMat;
  g.add(addShadow(box(THREE, 2.35, 0.52, 1.25, carMat, 0, 0.45, 0)));
  g.add(addShadow(box(THREE, 1.05, 0.5, 1.05, mats.window, -0.12, 0.92, 0)));
  g.add(addShadow(box(THREE, 0.55, 0.25, 1.1, mats.light, 1.08, 0.55, 0)));
  [-0.72, 0.72].forEach(function (x) {
    [-0.62, 0.62].forEach(function (z) {
      var wh = cylinder(THREE, 0.22, 0.22, 0.18, 8, dark);
      wh.rotation.x = Math.PI / 2;
      wh.position.set(x, 0.28, z);
      g.add(addShadow(wh));
    });
  });
  return g;
}

function buildTerrain(THREE, mats) {
  var group = new THREE.Group();
  var plane = new THREE.Mesh(new THREE.PlaneGeometry(ARENA, ARENA, 42, 42), mats.dirt);
  plane.rotation.x = -Math.PI / 2;
  var pos = plane.geometry.attributes.position;
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i);
    var y = pos.getY(i);
    pos.setZ(i, groundHeight(x, -y) - 0.03);
  }
  pos.needsUpdate = true;
  plane.geometry.computeVertexNormals();
  plane.receiveShadow = true;
  group.add(plane);

  var ringMat = mats.barrier;
  var wallT = 0.45, wallH = 1.4;
  [[0, HALF, ARENA, wallT], [0, -HALF, ARENA, wallT], [HALF, 0, wallT, ARENA], [-HALF, 0, wallT, ARENA]].forEach(function (r) {
    var wall = box(THREE, r[2], wallH, r[3], ringMat, r[0], wallH / 2, r[1]);
    group.add(addShadow(wall));
  });

  for (var b = 0; b < 18; b++) {
    var angle = (b / 18) * Math.PI * 2;
    var tire = cylinder(THREE, 0.52, 0.52, 0.24, 10, mats.tire);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(Math.cos(angle) * 18.6, 0.55, Math.sin(angle) * 18.6);
    tire.rotation.y = -angle;
    group.add(addShadow(tire));
  }

  var arch = new THREE.Group();
  arch.add(addShadow(box(THREE, 0.45, 3.4, 0.45, mats.metal, -4.1, 1.7, 0)));
  arch.add(addShadow(box(THREE, 0.45, 3.4, 0.45, mats.metal, 4.1, 1.7, 0)));
  arch.add(addShadow(box(THREE, 8.7, 0.6, 0.55, mats.truckRed, 0, 3.6, 0)));
  arch.position.set(0, 0, -18.8);
  group.add(arch);

  var sign = box(THREE, 6.8, 0.78, 0.18, mats.truckYellow, 0, 3.75, -19.1);
  sign.name = "arenaSign";
  group.add(addShadow(sign));
  return group;
}

function spawnCars(THREE, mats) {
  var colors = [0xE85545, 0x4EA8FF, 0x46B46A, 0xE6B43F, 0xA56DE2, 0xF07E3D, 0xE64E8A, 0x73D6D0];
  R.cars = [];
  for (var i = 0; i < CAR_COUNT; i++) {
    var car = {
      mesh: makeCar(THREE, mats, colors[i % colors.length]),
      x: rand(-15, 15),
      z: rand(-14, 14),
      h: rand(-Math.PI, Math.PI),
      speed: rand(3.2, 5.6),
      turn: 0,
      targetH: rand(-Math.PI, Math.PI),
      crush: 0,
      crushed: false,
      respawnAt: 0,
      color: colors[i % colors.length]
    };
    car.mesh.position.set(car.x, groundHeight(car.x, car.z), car.z);
    R.scene.add(car.mesh);
    R.cars.push(car);
  }
}

function addArenaDust(x, z, count, color) {
  var THREE = R.THREE;
  for (var i = 0; i < count; i++) {
    if (R.debris.length >= MAX_DEBRIS) {
      var old = R.debris.shift();
      R.scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
    }
    var size = rand(0.14, 0.36);
    var mat = new THREE.MeshLambertMaterial({ color: color || 0xB77B3A, flatShading: true });
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(size * rand(0.7, 1.7), size, size * rand(0.7, 1.6)), mat);
    mesh.position.set(x + rand(-0.7, 0.7), groundHeight(x, z) + rand(0.3, 1.0), z + rand(-0.7, 0.7));
    mesh.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    addShadow(mesh);
    R.scene.add(mesh);
    R.debris.push({
      mesh: mesh,
      vx: rand(-5, 5),
      vy: rand(2, 7),
      vz: rand(-5, 5),
      rx: rand(-5, 5),
      ry: rand(-5, 5),
      rz: rand(-5, 5),
      life: rand(4, 7)
    });
  }
}

function addCarParts(car) {
  var THREE = R.THREE;
  var specs = [
    { w: 1.1, h: 0.18, d: 0.8, color: car.color, vy: 5.6 },
    { w: 0.95, h: 0.16, d: 0.55, color: car.color, vy: 4.8 },
    { w: 0.75, h: 0.24, d: 0.42, color: 0xB7ECFF, vy: 5.2 },
    { w: 0.55, h: 0.18, d: 0.95, color: 0xFFF3A8, vy: 4.5 }
  ];
  specs.forEach(function (s, i) {
    var mat = new THREE.MeshLambertMaterial({ color: s.color, flatShading: true });
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), mat);
    mesh.position.set(car.x + rand(-0.45, 0.45), groundHeight(car.x, car.z) + 0.55 + i * 0.08, car.z + rand(-0.45, 0.45));
    mesh.rotation.set(rand(0, 2), rand(0, 2), rand(0, 2));
    addShadow(mesh);
    R.scene.add(mesh);
    R.debris.push({
      mesh: mesh,
      vx: rand(-4.5, 4.5),
      vy: s.vy + rand(0, 2.5),
      vz: rand(-4.5, 4.5),
      rx: rand(-6, 6),
      ry: rand(-6, 6),
      rz: rand(-6, 6),
      life: rand(5, 8)
    });
  });
  for (var w = 0; w < 4; w++) {
    var tireMat = new THREE.MeshLambertMaterial({ color: 0x151821, flatShading: true });
    var tire = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 8), tireMat);
    tire.rotation.x = Math.PI / 2;
    tire.position.set(car.x + rand(-0.7, 0.7), groundHeight(car.x, car.z) + 0.45, car.z + rand(-0.7, 0.7));
    addShadow(tire);
    R.scene.add(tire);
    R.debris.push({
      mesh: tire,
      vx: rand(-6, 6),
      vy: rand(4, 7),
      vz: rand(-6, 6),
      rx: rand(-8, 8),
      ry: rand(-8, 8),
      rz: rand(-8, 8),
      life: rand(5, 8)
    });
  }
}

function crushCar(car) {
  if (car.crushed) return;
  car.crushed = true;
  car.crush = 1;
  car.respawnAt = performance.now() + 3600;
  R.score++;
  if (R.ctx && R.ctx.finish) R.ctx.finish({ score: R.score });
  if (R.ctx && R.ctx.sfx) R.ctx.sfx.win();
  if (R.score === 1 && R.ctx && R.ctx.sayPair) {
    R.ctx.sayPair("Monster crush!", "\u602a\u7378\u58d3\u8eca!");
  }
  updateHud();
  addCarParts(car);
  addArenaDust(car.x, car.z, 14, car.color);
  addArenaDust(car.x, car.z, 10, 0x222431);
  car.mesh.visible = false;
}

function resetCar(car) {
  car.x = rand(-16, 16);
  car.z = rand(-15, 15);
  car.h = rand(-Math.PI, Math.PI);
  car.speed = rand(3.2, 5.4);
  car.targetH = car.h;
  car.crushed = false;
  car.crush = 0;
  car.mesh.visible = true;
}

function updateHud() {
  var air = R.truck.y > groundHeight(R.truck.x, R.truck.z) + 0.35 ? "\u2708" : "\u2014";
  R.ctx.hud([
    { k: "Crushed \u58d3\u8eca", v: R.score, c: "#FFC93C" },
    { k: "Best \u6700\u4f73", v: Math.max(R.best, R.score) },
    { k: "Air \u98db\u8d77", v: air, c: air === "\u2708" ? "#4EA8FF" : "transparent" }
  ]);
}

function updateCars(dt) {
  var now = performance.now();
  for (var i = 0; i < R.cars.length; i++) {
    var car = R.cars[i];
    if (car.crushed) {
      if (now > car.respawnAt) resetCar(car);
      continue;
    }

    var toTruck = Math.hypot(R.truck.x - car.x, R.truck.z - car.z);
    if (toTruck < 7) {
      car.targetH = Math.atan2(car.z - R.truck.z, car.x - R.truck.x);
      car.speed = lerp(car.speed, 6.2, 0.02);
    } else if (Math.random() < 0.018) {
      car.targetH += rand(-0.9, 0.9);
      car.speed = rand(3.0, 5.8);
    }
    if (Math.abs(car.x) > HALF - 4 || Math.abs(car.z) > HALF - 4) {
      car.targetH = Math.atan2(-car.z, -car.x) + rand(-0.35, 0.35);
    }
    car.h += clamp(wrapAngle(car.targetH - car.h), -1.8 * dt, 1.8 * dt);
    car.x += Math.cos(car.h) * car.speed * dt;
    car.z += Math.sin(car.h) * car.speed * dt;
    car.x = clamp(car.x, -HALF + 2.2, HALF - 2.2);
    car.z = clamp(car.z, -HALF + 2.2, HALF - 2.2);
    var gy = groundHeight(car.x, car.z);
    car.mesh.position.set(car.x, gy + 0.05, car.z);
    car.mesh.rotation.set(groundPitch(car.x, car.z, car.h) * 0.35, -car.h + Math.PI / 2, groundRoll(car.x, car.z, car.h) * 0.35);

    var dx = R.truck.x - car.x, dz = R.truck.z - car.z;
    var dist = Math.hypot(dx, dz);
    if (dist < TRUCK_RADIUS + CAR_RADIUS) {
      var hitSpeed = Math.abs(R.truck.v);
      var truckGround = groundHeight(R.truck.x, R.truck.z);
      var landing = R.truck.y > truckGround + 0.45 || R.truck.vy < -1.8;
      if (hitSpeed > 5.5 || landing) {
        crushCar(car);
      } else {
        var push = (TRUCK_RADIUS + CAR_RADIUS - dist) * 0.65;
        var nx = dist > 0.01 ? dx / dist : Math.cos(R.truck.h);
        var nz = dist > 0.01 ? dz / dist : Math.sin(R.truck.h);
        car.x -= nx * push;
        car.z -= nz * push;
        car.targetH += 0.9;
        R.truck.v *= 0.8;
      }
    }
  }
}

function updateDebris(dt) {
  for (var i = R.debris.length - 1; i >= 0; i--) {
    var d = R.debris[i];
    d.life -= dt;
    d.vy -= 12 * dt;
    d.mesh.position.x += d.vx * dt;
    d.mesh.position.y += d.vy * dt;
    d.mesh.position.z += d.vz * dt;
    d.mesh.rotation.x += d.rx * dt;
    d.mesh.rotation.y += d.ry * dt;
    d.mesh.rotation.z += d.rz * dt;
    var g = groundHeight(d.mesh.position.x, d.mesh.position.z) + 0.08;
    if (d.mesh.position.y < g) {
      d.mesh.position.y = g;
      d.vy = Math.abs(d.vy) * 0.38;
      d.vx *= 0.72;
      d.vz *= 0.72;
    }
    if (Math.abs(d.mesh.position.x) > HALF || Math.abs(d.mesh.position.z) > HALF) {
      d.vx *= -0.45;
      d.vz *= -0.45;
      d.mesh.position.x = clamp(d.mesh.position.x, -HALF, HALF);
      d.mesh.position.z = clamp(d.mesh.position.z, -HALF, HALF);
    }
    if (d.life <= 0) {
      R.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mesh.material.dispose();
      R.debris.splice(i, 1);
    }
  }
}

function updateTruck(dt) {
  var k = R.keys;
  var truck = R.truck;
  var accel = k.g ? 18 : 0;
  var brake = k.b ? -14 : 0;
  truck.v += (accel + brake) * dt;
  truck.v *= Math.pow(0.48, dt);
  truck.v = clamp(truck.v, -9, 18);

  var steer = (k.l ? 1 : 0) - (k.r ? 1 : 0);
  var steerPower = 1.8 * (0.35 + Math.min(Math.abs(truck.v) / 12, 1) * 0.65);
  truck.h += steer * steerPower * dt * (truck.v >= 0 ? 1 : -1);

  var prevGround = groundHeight(truck.x, truck.z);
  truck.x += Math.cos(truck.h) * truck.v * dt;
  truck.z += Math.sin(truck.h) * truck.v * dt;
  if (Math.abs(truck.x) > HALF - 2.4) {
    truck.x = clamp(truck.x, -HALF + 2.4, HALF - 2.4);
    truck.v *= -0.25;
    addArenaDust(truck.x, truck.z, 3, 0xB77B3A);
  }
  if (Math.abs(truck.z) > HALF - 2.4) {
    truck.z = clamp(truck.z, -HALF + 2.4, HALF - 2.4);
    truck.v *= -0.25;
    addArenaDust(truck.x, truck.z, 3, 0xB77B3A);
  }

  var g = groundHeight(truck.x, truck.z);
  var climbing = g - prevGround;
  if (climbing > 0.06 && Math.abs(truck.v) > 7) {
    truck.vy += climbing * Math.abs(truck.v) * 0.55;
  }
  truck.vy -= 16 * dt;
  truck.y += truck.vy * dt;
  if (truck.y <= g) {
    if (truck.vy < -4.5) {
      addArenaDust(truck.x, truck.z, 8, 0xB77B3A);
      if (R.ctx && R.ctx.sfx) R.ctx.sfx.hit();
    }
    truck.y = g;
    truck.vy = Math.max(0, truck.vy * -0.18);
  }

  truck.mesh.position.set(truck.x, truck.y + 0.12, truck.z);
  truck.mesh.rotation.y = -truck.h + Math.PI / 2;
  truck.mesh.rotation.x = groundPitch(truck.x, truck.z, truck.h) + clamp(-truck.vy * 0.025, -0.18, 0.18);
  truck.mesh.rotation.z = groundRoll(truck.x, truck.z, truck.h) + steer * 0.08;
  for (var i = 0; i < truck.mesh.userData.wheels.length; i++) {
    truck.mesh.userData.wheels[i].rotation.y += truck.v * dt * 1.8;
  }
}

function updateCamera(dt) {
  var THREE = R.THREE;
  var back = new THREE.Vector3(-Math.cos(R.truck.h) * 9, 6.2, -Math.sin(R.truck.h) * 9);
  var target = new THREE.Vector3(R.truck.x, R.truck.y + 1.6, R.truck.z);
  var desired = target.clone().add(back);
  R.camera.position.lerp(desired, 1 - Math.pow(0.03, dt));
  R.camera.lookAt(target);
}

function tick() {
  if (!R || !R.running) return;
  R.timer.update();
  var dt = Math.min(R.timer.getDelta(), 0.05);
  updateTruck(dt);
  updateCars(dt);
  updateDebris(dt);
  updateCamera(dt);
  R.sky.rotation.y += dt * 0.03;
  R.renderer.render(R.scene, R.camera);
  R.raf = requestAnimationFrame(tick);
}

function hold(id, key) {
  var el = R.ui.querySelector("#" + id);
  if (!el) return;
  var down = function (e) {
    e.preventDefault();
    R.keys[key] = true;
    el.classList.add("is-down");
  };
  var up = function () {
    R.keys[key] = false;
    el.classList.remove("is-down");
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerout", up);
  R.listeners.push([el, "pointerdown", down], [el, "pointerup", up], [el, "pointercancel", up], [el, "pointerout", up]);
}

function bindKeys() {
  R.keydown = function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { e.preventDefault(); R.keys.l = true; }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { e.preventDefault(); R.keys.r = true; }
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { e.preventDefault(); R.keys.g = true; }
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { e.preventDefault(); R.keys.b = true; }
  };
  R.keyup = function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") R.keys.l = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") R.keys.r = false;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") R.keys.g = false;
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") R.keys.b = false;
  };
  addEventListener("keydown", R.keydown);
  addEventListener("keyup", R.keyup);
}

function buildUi() {
  var ui = document.createElement("div");
  ui.className = "mt-ui";
  ui.innerHTML =
    '<div class="mt-prompt">Crush cars and jump! \u58d3\u8eca\u548c\u98db\u8d8a\u5c0f\u5c71!</div>' +
    '<div class="mt-controls" aria-label="Monster truck controls">' +
      '<div class="mt-left">' +
        '<button id="mtLeft" class="mt-btn" title="Left \u5de6" aria-label="Left \u5de6">\u25c0</button>' +
        '<button id="mtRight" class="mt-btn" title="Right \u53f3" aria-label="Right \u53f3">\u25b6</button>' +
      '</div>' +
      '<div class="mt-right">' +
        '<button id="mtBack" class="mt-btn mt-btn--back" title="Reverse \u5f8c\u9000" aria-label="Reverse \u5f8c\u9000">\u25bc</button>' +
        '<button id="mtGas" class="mt-btn mt-btn--gas" title="Gas \u6cb9\u9580" aria-label="Gas \u6cb9\u9580">\u26a1</button>' +
      '</div>' +
    '</div>';
  return ui;
}

function disposeScene(scene) {
  if (!scene) return;
  scene.traverse(function (child) {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      var mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(function (m) {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

function onVisibility() {
  if (!R) return;
  if (document.hidden) {
    if (R.raf) { cancelAnimationFrame(R.raf); R.raf = null; }
  } else if (!R.raf) {
    if (R.timer) R.timer.reset();
    R.raf = requestAnimationFrame(tick);
  }
}

function initScene(THREE, ctx, mount) {
  var canvas = document.createElement("canvas");
  canvas.className = "mt-canvas";
  mount.appendChild(canvas);

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x8ED1E8);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8ED1E8, 35, 68);

  var w = Math.max(mount.clientWidth || 640, 1);
  var h = Math.max(mount.clientHeight || 320, 1);
  var camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 120);
  camera.position.set(-8, 6, -10);

  var mats = {
    dirt: material(THREE, 0xB87537),
    barrier: material(THREE, 0x2D315A),
    truckBlue: material(THREE, 0x1E75FF),
    truckYellow: material(THREE, 0xFFC93C),
    truckRed: material(THREE, 0xF24B36),
    truckDark: material(THREE, 0x242839),
    tire: material(THREE, 0x151821),
    hub: material(THREE, 0xD7DEE8),
    window: material(THREE, 0xB7ECFF),
    metal: material(THREE, 0xA8AEB8),
    light: material(THREE, 0xFFF3A8)
  };

  scene.add(new THREE.HemisphereLight(0xFFEFD0, 0x5E3C2C, 1.1));
  var sun = new THREE.DirectionalLight(0xFFF8DD, 1.5);
  sun.position.set(-12, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  scene.add(sun);

  var sky = new THREE.Mesh(
    new THREE.SphereGeometry(70, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0x8ED1E8, side: THREE.BackSide })
  );
  scene.add(sky);

  scene.add(buildTerrain(THREE, mats));
  var truckMesh = makeTruck(THREE, mats);
  scene.add(truckMesh);

  R.scene = scene;
  R.camera = camera;
  R.renderer = renderer;
  R.canvas = canvas;
  R.mats = mats;
  R.sky = sky;
  R.truck = { mesh: truckMesh, x: 0, z: 1, y: groundHeight(0, 1), h: -Math.PI / 2, v: 0, vy: 0 };
  R.debris = [];
  spawnCars(THREE, mats);

  R.resize = function () {
    var rw = Math.max(mount.clientWidth || 640, 1);
    var rh = Math.max(mount.clientHeight || 320, 1);
    renderer.setSize(rw, rh, false);
    camera.aspect = rw / Math.max(rh, 1);
    camera.updateProjectionMatrix();
  };
  R.resize();
  R.ro = new ResizeObserver(function () { if (R && R.resize) R.resize(); });
  R.ro.observe(mount);
}

var MT_CSS = [
  ".mt-game{position:relative;width:100%;height:100%;overflow:hidden;border:2px solid #2D315A;border-radius:16px;background:#8ED1E8;touch-action:none}",
  ".mt-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}",
  ".mt-ui{position:absolute;inset:0;z-index:2;pointer-events:none;font-family:'Fredoka',system-ui,sans-serif}",
  ".mt-prompt{position:absolute;top:8px;left:50%;transform:translateX(-50%);max-width:92%;background:rgba(28,20,54,.78);color:#F7F4FF;border:2px solid #FFC93C;border-radius:12px;padding:7px 12px;font-weight:700;font-size:17px;text-align:center;white-space:normal;box-shadow:0 8px 20px rgba(0,0,0,.18)}",
  ".mt-controls{position:absolute;left:10px;right:10px;bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;gap:10px}",
  ".mt-left,.mt-right{display:flex;gap:10px;align-items:flex-end}",
  ".mt-btn{width:64px;height:64px;border-radius:50%;border:2px solid rgba(255,255,255,.7);background:rgba(28,20,54,.62);color:#fff;font-family:'Fredoka',system-ui,sans-serif;font-weight:800;font-size:28px;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;box-shadow:0 6px 0 rgba(0,0,0,.26);user-select:none;-webkit-tap-highlight-color:transparent}",
  ".mt-btn--gas{width:78px;height:78px;background:rgba(255,201,60,.92);color:#1C1436;border-color:#FFF1A8;font-size:34px}",
  ".mt-btn--back{background:rgba(78,168,255,.7);border-color:#BDEBFF}",
  ".mt-btn.is-down,.mt-btn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.26)}",
  "@media (max-width:620px){.mt-btn{width:58px;height:58px;font-size:24px}.mt-btn--gas{width:70px;height:70px;font-size:30px}.mt-left,.mt-right{gap:8px}.mt-controls{left:8px;right:8px;bottom:8px}}"
].join("\n");

export default {
  id: "monster-truck",
  meta: meta,
  keyboard: false,
  bestKey: "monster_truck",

  async init(ctx) {
    var THREE = await import("../vendor/three.module.min.js");
    var mount = ctx.mount;
    if (!mount.style.position || mount.style.position === "static") {
      mount.style.position = "relative";
    }
    mount.innerHTML = "";

    R = {
      THREE: THREE,
      ctx: ctx,
      best: ctx.best || 0,
      score: 0,
      running: true,
      keys: { l: false, r: false, g: false, b: false },
      listeners: [],
      root: document.createElement("div"),
      styleNode: addStyle(MT_CSS),
      timer: new THREE.Timer()
    };
    R.root.className = "game-scene mt-game";
    mount.appendChild(R.root);
    R.ui = buildUi();
    R.root.appendChild(R.ui);
    initScene(THREE, ctx, R.root);
    R.root.appendChild(R.ui);

    hold("mtLeft", "l");
    hold("mtRight", "r");
    hold("mtGas", "g");
    hold("mtBack", "b");
    bindKeys();
    document.addEventListener("visibilitychange", onVisibility);

    if (ctx.sayPair) ctx.sayPair("Crush cars and jump!", "\u58d3\u8eca\u548c\u98db\u8d8a\u5c0f\u5c71!");
    updateHud();
    R.raf = requestAnimationFrame(tick);
  },

  stop: function () {
    if (!R) return;
    R.running = false;
    if (R.raf) { cancelAnimationFrame(R.raf); R.raf = null; }
    if (R.keydown) removeEventListener("keydown", R.keydown);
    if (R.keyup) removeEventListener("keyup", R.keyup);
    document.removeEventListener("visibilitychange", onVisibility);
    for (var i = 0; i < R.listeners.length; i++) {
      var l = R.listeners[i];
      l[0].removeEventListener(l[1], l[2]);
    }
    if (R.ro) { R.ro.disconnect(); R.ro = null; }
    if (R.scene) disposeScene(R.scene);
    if (R.renderer) {
      R.renderer.dispose();
      var canvas = R.renderer.domElement;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      try { R.renderer.forceContextLoss(); } catch (e) {}
    }
    if (R.styleNode && R.styleNode.parentNode) R.styleNode.parentNode.removeChild(R.styleNode);
    if (R.root && R.root.parentNode) R.root.parentNode.removeChild(R.root);
    if (R.timer) R.timer.dispose();
    R = null;
  },

  debugState: function () { return R; }
};
