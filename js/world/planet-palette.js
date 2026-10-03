/* Pixel Planet palette — the only colours the world ever draws (design D1).
   Indices are stable: planet-map stores them, sprites reference them by key char. */

export const HEX = [
  "#0b0a1f", // 0  outline
  "#17153b", // 1  space
  "#2a2560", // 2  space2 / night ocean
  "#123d33", // 3  greenDeep
  "#232174", // 4  oceanDark
  "#3340b8", // 5  ocean
  "#4d78e0", // 6  oceanLit
  "#8fd3ff", // 7  ice / shore foam
  "#1d5e45", // 8  greenDark
  "#2f9a4c", // 9  green
  "#7bd34b", // 10 greenLit
  "#c9ef6a", // 11 lime
  "#5a2d2a", // 12 rockDark
  "#8e4a3a", // 13 rock
  "#c9744a", // 14 rockLit
  "#ff7a1f", // 15 lava
  "#ffd23f", // 16 yellow
  "#e3b770", // 17 sand
  "#f6e2a4", // 18 sandLit
  "#a8743f", // 19 wood
  "#6b4528", // 20 woodDark
  "#ff5fa2", // 21 pink
  "#b5309a", // 22 magenta
  "#5b1e7a", // 23 purpleDark
  "#9a5ae0", // 24 purple
  "#d8c4ff", // 25 lilac
  "#ffffff", // 26 white
  "#c4d4ec", // 27 snowShade
  "#7d8fb8", // 28 steel
  "#e8402e", // 29 red
  "#39d0c8", // 30 cyan
  "#8a8aa8"  // 31 grey
];

export const C = {
  outline:0, space:1, space2:2, greenDeep:3, oceanDark:4, ocean:5, oceanLit:6, ice:7,
  greenDark:8, green:9, greenLit:10, lime:11, rockDark:12, rock:13, rockLit:14, lava:15,
  yellow:16, sand:17, sandLit:18, wood:19, woodDark:20, pink:21, magenta:22, purpleDark:23,
  purple:24, lilac:25, white:26, snowShade:27, steel:28, red:29, cyan:30, grey:31
};

/* One step darker / lighter inside the palette, per index. Shading never leaves the palette. */
export const DARK = Uint8Array.from([0,0,1,0,2,4,5,6,3,8,9,10,0,12,13,29,15,19,17,20,12,22,23,2,23,24,27,28,2,12,6,28]);
export const LIGHT = Uint8Array.from([2,2,23,8,5,6,7,26,9,10,11,18,13,14,17,16,18,18,26,17,19,25,21,24,25,26,26,26,27,15,7,27]);

function parseHex(hex){
  var n = parseInt(String(hex).replace("#",""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ImageData is RGBA bytes; on little-endian hosts a Uint32 view reads them as ABGR. */
export const RGBA = Uint32Array.from(HEX.map(function(hex){
  var c = parseHex(hex);
  return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
}));

export function nearestIndex(hex){
  var target = parseHex(hex), best = 0, bestDist = Infinity;
  if (!/^#?[0-9a-fA-F]{6}$/.test(String(hex))) return C.cyan;
  for (var i = 0; i < HEX.length; i++) {
    if (i === C.outline || i === C.space || i === C.space2) continue;
    var c = parseHex(HEX[i]), d = (c[0]-target[0])*(c[0]-target[0]) + (c[1]-target[1])*(c[1]-target[1]) + (c[2]-target[2])*(c[2]-target[2]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

export function luminance(index){
  var c = parseHex(HEX[index]);
  return (0.299*c[0] + 0.587*c[1] + 0.114*c[2]) / 255;
}
