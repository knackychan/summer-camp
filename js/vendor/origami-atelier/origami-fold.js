/* Fold maths for the diagram engine (docs/plans/2026-10-05-origami-audit/ slice 01). Pure: no DOM.
   A fold turns the paper on one side of the crease over onto the other side: every point keeps
   its place along the crease and its distance across it is multiplied by s, going 1 → −1.
   Points are [x, y] in the diagram's view-box units. */

const EPS = 1e-6;

/* > 0 on the left of a→b, < 0 on the right, 0 on the line. */
export function sideOf(p, a, b) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

export function centroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

export function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(s) / 2;
}

/* The part of a polygon on one side (sign of `side`) of the infinite line through a, b.
   Sutherland–Hodgman against a single half-plane. */
export function clipByLine(poly, a, b, side) {
  const sign = side < 0 ? -1 : 1;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const dist = (p) => sign * sideOf(p, a, b) / len;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = dist(p), dq = dist(q);
    if (dp >= -EPS) out.push(p);
    if ((dp > EPS && dq < -EPS) || (dp < -EPS && dq > EPS)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  const clean = [];
  for (const p of out) {
    const last = clean[clean.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > EPS) clean.push(p);
  }
  if (clean.length > 1 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) <= EPS) clean.pop();
  return clean.length >= 3 ? clean : [];
}

/* The 2×3 matrix [a, b, c, d, e, f] (CSS order: x' = a·x + c·y + e, y' = b·x + d·y + f) that keeps
   the crease a→b and scales the distance across it by s. s = −1 is the mirror image. */
export function hingeMatrix(a, b, s) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
  const nx = -uy, ny = ux;
  const m00 = ux * ux + s * nx * nx, m01 = ux * uy + s * nx * ny;
  const m10 = m01, m11 = uy * uy + s * ny * ny;
  return [m00, m10, m01, m11, a[0] - (m00 * a[0] + m01 * a[1]), a[1] - (m10 * a[0] + m11 * a[1])];
}

export function apply(m, p) {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

export function reflect(poly, a, b) {
  const m = hingeMatrix(a, b, -1);
  return poly.map(p => apply(m, p));
}

/* The same transform as hingeMatrix, written as a CSS function list. Every keyframe has the same
   list, so the browser interpolates the scale number instead of decomposing a mirror matrix
   (which it would turn into a 180° spin). */
export function hingeTransform(a, b, s) {
  const deg = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  return `translate(${a[0]}px,${a[1]}px) rotate(${deg}deg) scale(1,${s}) rotate(${-deg}deg) translate(${-a[0]}px,${-a[1]}px)`;
}

/* Turning the whole sheet around point c. */
export function turnTransform(c, deg) {
  return `translate(${c[0]}px,${c[1]}px) rotate(${deg}deg) translate(${-c[0]}px,${-c[1]}px)`;
}

/* n + 1 samples of a fold: u is the share of the fold's time, s = cos(π·t) with t eased in and
   out, so the paper lifts, swings over the crease and settles. s is exactly 0 at u = 0.5 when n is
   even; that is where the paper is edge-on and the visible face changes. */
export function hingeSamples(n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const t = (1 - Math.cos(Math.PI * u)) / 2;
    const s = Math.abs(u - 0.5) < EPS ? 0 : Math.cos(Math.PI * t);
    out.push({ u, s });
  }
  return out;
}

/* The arrow for a fold: from the far edge of the moving part, straight out from the middle of the
   crease, to where that point lands; bowed along the crease so it reads as an arc over the fold.
   Returns [start, control, end] for a quadratic curve. */
export function foldArrow(flap, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len;
  const c = centroid(flap);
  const toFlap = Math.sign(sideOf(c, a, b)) || 1;
  const nx = -ty * toFlap, ny = tx * toFlap;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  /* Farthest crossing of the ray m + t·n with the flap's edges. */
  let reach = 0;
  for (let i = 0; i < flap.length; i++) {
    const p = flap[i], q = flap[(i + 1) % flap.length];
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const den = nx * ey - ny * ex;
    if (Math.abs(den) < EPS) continue;
    const wx = p[0] - m[0], wy = p[1] - m[1];
    const t = (wx * ey - wy * ex) / den;
    const k = (wx * ny - wy * nx) / den;
    if (t > reach && k >= -EPS && k <= 1 + EPS) reach = t;
  }
  let far = [m[0] + nx * reach, m[1] + ny * reach];
  if (reach < 5) {
    let best = -1;
    for (const p of flap) {
      const d = Math.abs(sideOf(p, a, b)) / len;
      if (d > best) { best = d; far = p; }
    }
  }
  const to = apply(hingeMatrix(a, b, -1), far);
  const vx = to[0] - far[0], vy = to[1] - far[1], span = Math.hypot(vx, vy) || 1;
  const ux = vx / span, uy = vy / span;
  const inset = Math.min(14, span * 0.18);
  const start = [far[0] + ux * inset, far[1] + uy * inset];
  const end = [to[0] - ux * inset, to[1] - uy * inset];
  const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  /* Bow upward, or to the right when the crease is level. */
  const dir = ty > EPS ? -1 : ty < -EPS ? 1 : (tx >= 0 ? 1 : -1);
  const bow = span * 0.28 * dir;
  return [start, [mid[0] + tx * bow, mid[1] + ty * bow], end];
}
