/* Pixel Planet surface — an equirectangular grid of palette indices.
   Pure and deterministic: same seed, same planet. No DOM. */
import { C } from "./planet-palette.js";

export const MAP_W = 256;
export const MAP_H = 128;
export const BIOMES = ["ocean","village","arcade","volcano","snow","forest","grove","meadow","beach","ice","rock"];
export const DEFAULT_SEED = 7;

/* Section ids are district centres; featured content sits inside its parent biome. */
export const SITES = [
  {id:"section:quests",     biome:"village", lat:6,   lon:0},
  {id:"game:kitchen",       biome:"village", lat:4,   lon:20},
  {id:"section:games",      biome:"arcade",  lat:30,  lon:55},
  {id:"game:monster-truck", biome:"arcade",  lat:19,  lon:68},
  {id:"game:paint",         biome:"arcade",  lat:41,  lon:68},
  {id:"section:acts",       biome:"volcano", lat:-30, lon:42},
  {id:"section:learn",      biome:"snow",    lat:40,  lon:-55},
  {id:"game:solar",         biome:"snow",    lat:30,  lon:-71},
  {id:"section:books",      biome:"forest",  lat:-26, lon:-45},
  {id:"book:space",         biome:"forest",  lat:-15, lon:-31},
  {id:"section:music",      biome:"grove",   lat:24,  lon:122},
  {id:"section:day",        biome:"meadow",  lat:-26, lon:162},
  {id:"section:rewards",    biome:"beach",   lat:4,   lon:-122}
];

export const DISTRICTS = SITES.filter(function(site){return site.id.indexOf("section:")===0;}).map(function(site){
  return {biome:site.biome, lat:site.lat, lon:site.lon, radius:site.biome==="village"?0.42:0.46};
});

var RAD = Math.PI/180;

export function latLonToVec(lat, lon){
  var la = lat*RAD, lo = lon*RAD, c = Math.cos(la);
  return [c*Math.sin(lo), Math.sin(la), c*Math.cos(lo)];
}
export function cellLatLon(col, row){
  return {lat:90-(row+0.5)/MAP_H*180, lon:(col+0.5)/MAP_W*360-180};
}
export function cellIndex(lat, lon){
  var col = Math.floor((lon+180)/360*MAP_W), row = Math.floor((90-lat)/180*MAP_H);
  col = ((col % MAP_W) + MAP_W) % MAP_W;
  row = Math.max(0, Math.min(MAP_H-1, row));
  return row*MAP_W + col;
}
export function angleBetween(a, b){
  var d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

function hash3(x, y, z, seed){
  var h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function smooth(t){return t*t*(3-2*t);}
function lerp(a, b, t){return a+(b-a)*t;}
/* Runs ~200k times while the planet is built: no per-call closures. */
function valueNoise(x, y, z, seed){
  var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), x1 = xi+1, y1 = yi+1, z1 = zi+1;
  var tx = smooth(x-xi), ty = smooth(y-yi), tz = smooth(z-zi);
  var x00 = lerp(hash3(xi,yi,zi,seed), hash3(x1,yi,zi,seed), tx), x10 = lerp(hash3(xi,y1,zi,seed), hash3(x1,y1,zi,seed), tx);
  var x01 = lerp(hash3(xi,yi,z1,seed), hash3(x1,yi,z1,seed), tx), x11 = lerp(hash3(xi,y1,z1,seed), hash3(x1,y1,z1,seed), tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}
export function fbm(v, scale, seed){
  return 0.65*valueNoise(v[0]*scale, v[1]*scale, v[2]*scale, seed)
       + 0.35*valueNoise(v[0]*scale*2.1, v[1]*scale*2.1, v[2]*scale*2.1, seed+1);
}

/* Ground under sprites stays calm (planet-focus-readability slice 04): coarse two-tone
   patches and few specks in snow, arcade and forest, so sprites read against it. */
function biomeColor(biome, h, n, fine, gap){
  switch (biome) {
    case "village":
      if (h > 0.5 && h < 0.515) return C.pink;
      if (h >= 0.515 && h < 0.53) return C.yellow;
      if (h < 0.1 || n > 0.64) return C.greenLit;
      return h > 0.93 ? C.greenDark : C.green;
    case "arcade":
      if (h < 0.012) return C.cyan;
      if (h < 0.022) return C.pink;
      if (h < 0.03) return C.yellow;
      return n > 0.6 ? C.purple : C.purpleDark;
    case "volcano":
      if (gap < -0.39) return C.lava;
      if (gap < -0.35) return C.rockDark;
      if (Math.abs(fine-0.5) < 0.025) return C.lava;
      return n > 0.6 ? C.rockLit : n < 0.38 ? C.rockDark : C.rock;
    case "snow":
      if (h < 0.012) return C.steel;
      return n < 0.56 ? C.snowShade : C.white;
    case "forest":
      if (h < 0.02) return C.greenDeep;
      return n > 0.66 ? C.greenLit : n > 0.54 ? C.green : C.greenDark;
    case "grove":
      if (h < 0.04) return C.cyan;
      return fine > 0.7 ? C.lilac : fine > 0.6 ? C.pink : C.magenta;
    case "meadow":
      if (h < 0.06) return C.yellow;
      if (h < 0.08) return C.white;
      return n > 0.6 ? C.lime : n < 0.35 ? C.green : C.greenLit;
    case "beach":
      if (h < 0.03) return C.pink;
      if (gap > -0.05) return C.sandLit;
      return n > 0.58 ? C.sandLit : C.sand;
    case "ice":
      return n > 0.62 ? C.white : n < 0.4 ? C.ice : C.snowShade;
    case "rock":
      return n > 0.6 ? C.rockLit : n < 0.4 ? C.rockDark : C.rock;
    default:
      if (gap < 0.012) return C.ice;
      if (gap < 0.035) return C.oceanLit;
      if (h < 0.015) return C.oceanLit;
      return n < 0.4 ? C.oceanDark : C.ocean;
  }
}

function slerpVec(a, b, t){
  var omega = angleBetween(a, b), s = Math.sin(omega);
  if (s < 1e-6) return a.slice();
  var wa = Math.sin((1-t)*omega)/s, wb = Math.sin(t*omega)/s;
  return [a[0]*wa+b[0]*wb, a[1]*wa+b[1]*wb, a[2]*wa+b[2]*wb];
}
function vecLatLon(v){
  return {lat:Math.asin(Math.max(-1, Math.min(1, v[1])))/RAD, lon:Math.atan2(v[0], v[2])/RAD};
}

/* Paths hop between neighbouring districts so none cuts through another biome. */
export const PATH_EDGES = [["village","arcade"],["village","volcano"],["village","snow"],["village","forest"],["arcade","grove"],["volcano","meadow"],["forest","beach"]];
export function district(biome){
  for (var i = 0; i < DISTRICTS.length; i++) if (DISTRICTS[i].biome === biome) return DISTRICTS[i];
  return null;
}

/* Great-circle samples between two districts. Shared by the map and its tests. */
export function pathPoints(fromBiome, toBiome, steps){
  var a = district(fromBiome), b = district(toBiome);
  var from = latLonToVec(a.lat, a.lon), end = latLonToVec(b.lat, b.lon), out = [];
  for (var i = 0; i <= steps; i++) out.push(vecLatLon(slerpVec(from, end, i/steps)));
  return out;
}

export function buildPlanetMap(seed){
  seed = seed == null ? DEFAULT_SEED : seed;
  var size = MAP_W*MAP_H, color = new Uint8Array(size), biome = new Uint8Array(size), path = new Uint8Array(size);
  var centres = DISTRICTS.map(function(d){return latLonToVec(d.lat, d.lon);});
  for (var row = 0; row < MAP_H; row++) {
    for (var col = 0; col < MAP_W; col++) {
      var ll = cellLatLon(col, row), v = latLonToVec(ll.lat, ll.lon), i = row*MAP_W + col;
      var n = fbm(v, 3.2, seed), h = hash3(col, row, 0, seed+99), fine = fbm(v, 14, seed+5), edge = (n-0.5)*0.22;
      var best = -1, gap = Infinity;
      for (var d = 0; d < DISTRICTS.length; d++) {
        var score = angleBetween(v, centres[d]) - (DISTRICTS[d].radius + edge);
        if (score < gap) { gap = score; best = d; }
      }
      var polar = (Math.abs(ll.lat) - (70 + (n-0.5)*14)) * RAD;
      var name = "ocean";
      if (polar > 0) name = ll.lat > 0 ? "ice" : "rock";
      else if (gap < 0) name = DISTRICTS[best].biome;
      else gap = Math.min(gap, -polar);
      biome[i] = BIOMES.indexOf(name);
      color[i] = biomeColor(name, h, n, fine, gap);
    }
  }
  PATH_EDGES.forEach(function(edge){
    pathPoints(edge[0], edge[1], 240).forEach(function(p, step){
      [cellIndex(p.lat, p.lon), cellIndex(p.lat, p.lon + 360/MAP_W)].forEach(function(i){
        path[i] = 1;
        color[i] = biome[i] === 0 ? (step % 3 === 0 ? C.woodDark : C.wood) : (step % 2 ? C.sand : C.sandLit);
      });
    });
  });
  return {width:MAP_W, height:MAP_H, color:color, biome:biome, path:path, sites:SITES};
}

/* Cloud layer: 0 clear, 1 cloud. Drifts over the surface at its own longitude offset. */
export function buildCloudMap(seed){
  seed = seed == null ? DEFAULT_SEED : seed;
  var out = new Uint8Array(MAP_W*MAP_H);
  for (var row = 0; row < MAP_H; row++) {
    for (var col = 0; col < MAP_W; col++) {
      var ll = cellLatLon(col, row), v = latLonToVec(ll.lat, ll.lon);
      out[row*MAP_W + col] = fbm([v[0], v[1]*3, v[2]], 4.2, seed+11) > 0.72 ? 1 : 0;
    }
  }
  return out;
}
