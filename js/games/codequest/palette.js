/* Code Quest palette: the Pixel Planet palette (indices 0–31, unchanged) plus a
   small dungeon ramp the planet never needed — neutral stone, torch-warm stone and
   skin. Only Code Quest draws with indices 32+ (redesign design.md D3). */
import { HEX, C } from '../../world/planet-palette.js';

const EXTRA = [
  '#14132a', // 32 deep       wall shadow, void
  '#23223b', // 33 stoneDark  mortar, floor shade
  '#33324f', // 34 stone      floor base
  '#46456a', // 35 stoneMid   floor lit, wall face
  '#615f88', // 36 stoneLit   wall top, highlights
  '#3d2c3a', // 37 warmDark   torch-lit floor shade
  '#5b4250', // 38 warm       torch-lit floor
  '#87605a', // 39 warmLit    torch-lit highlight
  '#f2b88f', // 40 skin
  '#c7805f'  // 41 skinShade
];

export const CQ_HEX = Object.freeze([...HEX, ...EXTRA]);
export const Q = Object.freeze({
  ...C, deep:32, stoneDark:33, stone:34, stoneMid:35, stoneLit:36,
  warmDark:37, warm:38, warmLit:39, skin:40, skinShade:41
});
