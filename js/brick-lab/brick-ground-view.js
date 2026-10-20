/* Painted ground, drawn (docs/plans/2026-10-20-terrain-painter/ slice 02).
   One 64x64 plane just above the plate carries the terrain colours in a
   128x128 DataTexture (2x2 texels per cell, so flowers and stone path get
   their accent texels); the instanced studs, when there are any, take the
   same colour per instance. Slow tablets keep only the flat plane. */
import { CELLS, GRID, PLAIN, PLAIN_COLOR, cleanGround, terrainOf } from "./brick-ground.js";

const SUB = 2;
const SIDE = GRID * SUB;

const bytes = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const darker = (hex, k) => ((((hex >> 16) & 255) * k) << 16) | ((((hex >> 8) & 255) * k) << 8) | ((hex & 255) * k) | 0;

/* opts: { THREE, scene, kit, material (plane, from litMaterial), studs (InstancedMesh | null), invalidate } */
export function createGroundView(opts) {
  const { THREE, scene, studs } = opts;
  const data = new Uint8Array(SIDE * SIDE * 4);
  const texture = new THREE.DataTexture(data, SIDE, SIDE, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = opts.material;
  material.map = texture;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID), material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.002;
  plane.receiveShadow = true;
  plane.raycast = () => {}; /* placement keeps hitting the plate */
  scene.add(plane);
  const tint = new THREE.Color();

  function put(x, y, hex) {
    const o = (y * SIDE + x) * 4;
    const [r, g, b] = bytes(hex);
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
  }

  /* Row (GRID-1-iz): the plane is turned -90 degrees, so texture row 0 is +z. */
  function paintCell(i, letter) {
    const t = terrainOf(letter);
    const x0 = (i % GRID) * SUB;
    const y0 = (GRID - 1 - Math.floor(i / GRID)) * SUB;
    for (let dy = 0; dy < SUB; dy++) for (let dx = 0; dx < SUB; dx++) put(x0 + dx, y0 + dy, t.color);
    const h = Math.imul(i, 2654435761) >>> 0;
    const sub = (h >>> 29) & 3;
    const ax = x0 + (sub & 1);
    const ay = y0 + (sub >> 1);
    if (t.dots) put(ax, ay, t.dots[(h >>> 27) % t.dots.length]);
    else if (t.id === "stone") put(ax, ay, darker(t.color, 0.78));
    if (studs) {
      tint.setHex(t.color);
      studs.setColorAt(i, tint);
    }
  }

  let current = PLAIN;
  for (let i = 0; i < CELLS; i++) paintCell(i, PLAIN[i]);
  texture.needsUpdate = true;
  if (studs && studs.instanceColor) studs.instanceColor.needsUpdate = true;

  return {
    /* Rewrites only the cells that differ from what is drawn. */
    set(next) {
      const to = cleanGround(next);
      if (to === current) return false;
      for (let i = 0; i < CELLS; i++) if (to[i] !== current[i]) paintCell(i, to[i]);
      current = to;
      texture.needsUpdate = true;
      if (studs && studs.instanceColor) studs.instanceColor.needsUpdate = true;
      if (opts.invalidate) opts.invalidate();
      return true;
    },
    get cells() { return current; },
    dispose() {
      plane.geometry.dispose();
      texture.dispose();
    },
  };
}

export { PLAIN_COLOR };
