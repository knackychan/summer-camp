/* Pixel Planet globe — quaternion math, projection and the per-pixel fill.
   View space: x right, y up, z toward the viewer. A surface point is visible when its view z > 0.
   `view` = {rotation:[x,y,z,w] (planet -> view), radius (art px), cx, cy (buffer px)}. */
import { RGBA, DARK, LIGHT, C } from "./planet-palette.js";
import { MAP_W, MAP_H, latLonToVec } from "./planet-map.js";

var RAD = Math.PI/180;
var BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
export var LIGHT_DIR = [-0.55, 0.6, 0.58];

export function quatAxisAngle(axis, angle){
  var s = Math.sin(angle/2);
  return [axis[0]*s, axis[1]*s, axis[2]*s, Math.cos(angle/2)];
}
/* a*b: rotating by the result applies b first, then a. */
export function quatMul(a, b){
  return [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]
  ];
}
export function quatNormalize(q){
  var l = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]) || 1;
  return [q[0]/l, q[1]/l, q[2]/l, q[3]/l];
}
export function quatConj(q){return [-q[0], -q[1], -q[2], q[3]];}
export function quatRotate(q, v){
  var tx = 2*(q[1]*v[2] - q[2]*v[1]), ty = 2*(q[2]*v[0] - q[0]*v[2]), tz = 2*(q[0]*v[1] - q[1]*v[0]);
  return [
    v[0] + q[3]*tx + (q[1]*tz - q[2]*ty),
    v[1] + q[3]*ty + (q[2]*tx - q[0]*tz),
    v[2] + q[3]*tz + (q[0]*ty - q[1]*tx)
  ];
}
export function quatSlerp(a, b, t){
  var d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) return quatNormalize([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, a[3]+(b[3]-a[3])*t]);
  var omega = Math.acos(d), s = Math.sin(omega), wa = Math.sin((1-t)*omega)/s, wb = Math.sin(t*omega)/s;
  return [a[0]*wa+b[0]*wb, a[1]*wa+b[1]*wb, a[2]*wa+b[2]*wb, a[3]*wa+b[3]*wb];
}
/* Rotation that puts (lat, lon) at the disc centre with north up. */
export function facingQuat(lat, lon){
  return quatMul(quatAxisAngle([1,0,0], lat*RAD), quatAxisAngle([0,1,0], -lon*RAD));
}
function quatMatrix(q){
  var x = q[0], y = q[1], z = q[2], w = q[3];
  return [
    1-2*(y*y+z*z), 2*(x*y-z*w),   2*(x*z+y*w),
    2*(x*y+z*w),   1-2*(x*x+z*z), 2*(y*z-x*w),
    2*(x*z-y*w),   2*(y*z+x*w),   1-2*(x*x+y*y)
  ];
}

export function project(lat, lon, view){
  var p = quatRotate(view.rotation, latLonToVec(lat, lon));
  return {x:view.cx + p[0]*view.radius, y:view.cy - p[1]*view.radius, z:p[2]};
}
export function unproject(x, y, view){
  var nx = (x - view.cx)/view.radius, ny = -(y - view.cy)/view.radius, d2 = nx*nx + ny*ny;
  if (d2 > 1) return null;
  var local = quatRotate(quatConj(view.rotation), [nx, ny, Math.sqrt(1-d2)]);
  return {lat:Math.asin(Math.max(-1, Math.min(1, local[1])))/RAD, lon:Math.atan2(local[0], local[2])/RAD};
}

/* Map row and drifting cloud column under a surface point (radians). drawGlobe paints with
   these and cloudAtPoint hit-tests taps with them, so a tapped cloud is the one on screen. */
function mapRow(lat){
  var row = ((Math.PI/2 - lat)/Math.PI*MAP_H) | 0;
  return row >= MAP_H ? MAP_H - 1 : row;
}
export function cloudColumn(lon, shift){
  var cc = (((lon + shift + Math.PI)/(Math.PI*2)*MAP_W) | 0) % MAP_W;
  return cc < 0 ? cc + MAP_W : cc;
}
export function cloudAtPoint(clouds, x, y, view, shift){
  var ll = unproject(x, y, view);
  return !!ll && !!clouds[mapRow(ll.lat*RAD)*MAP_W + cloudColumn(ll.lon*RAD, shift || 0)];
}

/* Fills target.data (Uint32 RGBA) with the shaded globe; everything else becomes transparent.
   cloudOffset is in radians of longitude. clouds may be null. */
export function drawGlobe(target, map, clouds, view, cloudOffset){
  var data = target.data, w = target.width, h = target.height, R = view.radius, cx = view.cx, cy = view.cy;
  var M = quatMatrix(quatConj(view.rotation)), L = LIGHT_DIR, colors = map.color, shift = cloudOffset || 0;
  var TWO_PI = Math.PI*2, ext = Math.ceil(R + 3);
  data.fill(0);
  var x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(w - 1, Math.ceil(cx + ext));
  var y0 = Math.max(0, Math.floor(cy - ext)), y1 = Math.min(h - 1, Math.ceil(cy + ext));
  for (var py = y0; py <= y1; py++) {
    var ny = -(py + 0.5 - cy)/R;
    for (var px = x0; px <= x1; px++) {
      var nx = (px + 0.5 - cx)/R, d2 = nx*nx + ny*ny, at = py*w + px;
      if (d2 > 1) {
        var dist = Math.sqrt(d2)*R;
        /* The atmosphere glow is CSS behind the canvas (readability slice 05). */
        if (dist <= R + 1) data[at] = RGBA[C.outline];
        continue;
      }
      var nz = Math.sqrt(1 - d2);
      var lx = M[0]*nx + M[1]*ny + M[2]*nz, ly = M[3]*nx + M[4]*ny + M[5]*nz, lz = M[6]*nx + M[7]*ny + M[8]*nz;
      var lon = Math.atan2(lx, lz), lat = Math.asin(ly > 1 ? 1 : ly < -1 ? -1 : ly);
      var row = mapRow(lat), col = ((lon + Math.PI)/TWO_PI*MAP_W) | 0;
      if (col >= MAP_W) col = MAP_W - 1;
      var c = colors[row*MAP_W + col], cloud = 0;
      if (clouds) {
        var cc = cloudColumn(lon, shift);
        cloud = clouds[row*MAP_W + cc];
        if (cloud) c = cloud === 2 ? C.snowShade : C.white;
        else if (row > 0 && clouds[(row - 1)*MAP_W + (cc + MAP_W - 1) % MAP_W]) c = DARK[c];
      }
      /* Clouds are lit in solid bands, not dithered. */
      var lam = nx*L[0] + ny*L[1] + nz*L[2], v = cloud ? lam : lam + (BAYER[(py & 3)*4 + (px & 3)]/16 - 0.47)*0.18;
      if (v > 0.75 || (d2 > 0.93 && lam > 0.3)) c = LIGHT[c];
      else if (v <= 0.15) c = v > -0.2 ? DARK[c] : DARK[DARK[c]];
      data[at] = RGBA[c];
    }
  }
}
