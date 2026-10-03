/* Code Quest pixel-sprite atlas. The RPG model never depends on these frames.
   Final Summer Quest sprite sheets can replace this atlas without touching the
   AST, interpreter, quests, saves, combat or dungeon projection. */
import { C, DARK, nearestIndex } from '../../world/planet-palette.js';
import { CQ_HEX } from './palette.js';
import { WORLD_SPRITES, WORLD_CHARS } from './sprites-world.js';

const P = Object.freeze({
  K: C.outline, D: C.rockDark, R: C.red, F: C.lava, S: C.sand, L: C.sandLit,
  G: C.green, H: C.greenDark, I: C.greenLit, Y: C.yellow, B: C.cyan,
  U: C.purple, W: C.white, M: C.magenta, Q: C.lilac, T: C.wood,
  O: C.woodDark, X: C.steel, Z: C.grey, N: C.snowShade, V: C.rock, J: C.rockLit
});

const LEGACY = Object.freeze({
  'hero-idle': [
    '....KK....','...KSSK...','..KSSSSK..','..KSKSKK..','..KSSSSK..','...KSSK...','..KKAAKK..','.KAAAAAAK.','KAAAKKAAAK','...KAAK...','...K..K...','..KK..KK..'
  ],
  'hero-walk-1': [
    '....KK....','...KSSK...','..KSSSSK..','..KSKSKK..','..KSSSSK..','...KSSK...','..KKAAKK..','.KAAAAAAK.','KAAAKKAAAK','...KAAK...','..KK...K..','..K....KK.'
  ],
  'hero-walk-2': [
    '....KK....','...KSSK...','..KSSSSK..','..KSKSKK..','..KSSSSK..','...KSSK...','..KKAAKK..','.KAAAAAAK.','KAAAKKAAAK','...KAAK...','...K...KK.','..KK....K.'
  ],
  'hero-attack': [
    '....KK.....','...KSSK....','..KSSSSK...','..KSKSKK...','..KSSSSK...','...KSSK....','..KKAAKK.X.','.KAAAAAAKXX','KAAAKKAAAKX','...KAAK..X.','...K..K....','..KK..KK...'
  ],
  'hero-hurt': [
    '....KK....','...KSSK...','..KSSSSK..','..KRRRK...','..KSSSSK..','...KSSK...','..KKAAKK..','.KAAAAAAK.','KAAAKKAAAK','...KAAK...','...K..K...','..KK..KK..'
  ],
  slime: [
    '..........','..........','...KKKK...','..KGGGGK..','.KGGIGGGK.','KGGGGGGGGK','KGGKGGKGGK','KGGGGGGGGK','.KGGGGGGK.','..KKKKKK..'
  ],
  goblin: [
    '...K..K...','..KHHHHK..','.KHHHHHHK.','KHHKHHKHHK','KHHHSSHHHK','.KSSSSSSK.','..KSSSSK..','..KKRRKK..','.KRRRRRRK.','KRRK..KRRK','...K..K...','..KK..KK..'
  ],
  golem: [
    '..KKKKKK..','.KDDDDDDK.','KDDXDDXDDK','KDDDDDDDDK','KDDDYYDDDK','KDDDDDDDDK','.KDDDDDDK.','KKDDDDDDKK','KDDDKKDDDK','KDDK..KDDK','KDK....KDK','KK......KK'
  ],

  bulwark: [
    '..KKKK....','.KDDDDK...','KDDXDDDK..','KDDDDDDK..','KDDYYDDK..','.KDDDDK...','..KKKKXX..','.KRRRKKXX.','KRRRRRRKX.','KRRK..KRK.','...K..K...','..KK..KK..'
  ],
  viper: [
    '..........','.....KK...','....KIIK..','...KIGIK..','..KIIGIIK.','.KIIKIIIK.','..KIIKIK..','...KIIK...','....KIK...','.....KK...'
  ],
  archer: [
    '...K..K...','..KSSSSK..','.KSSSSSSK.','KSSKSSKSSK','.KSSSSSSK.','..KSSSSK..','..KKUUKK..','.KUUUUUUK.','KUUUKKUUKK','...K..K.X.','..KK..KKX.','.......XX.'
  ],
  runeWarden: [
    '..KKKKKK..','.KUUQQUUK.','KUUQYYQUUK','KUUUUUUUUK','KUUYKKYUUK','.KUUUUUUK.','..KKXXKK..','.KXXUUXXK.','KXXUUUUXXK','KUUUKKUUUK','..KK..KK..','.KK....KK.'
  ],
  relicHydra: [
    '..KK....KK....KK..','.KUUY..KUUY..KUUY.','KUUQYKUUQYKUUQYUK','KUUUUUUUUUUUUUUUK','KUUYKKUUYKKUUYUK','.KUUUUUUUUUUUUUK.','..KKXXKKXXKKXXKK..','.KXXUUXXUUXXUUXXK.','KXXUUUUUUUUUUUUXXK','KUUUKKUUUKKUUUK','..KK..KK..KK..KK..','.KK....KK....KK...'
  ],
  emberImp: [
    '....YY....','...YFFY...','..YFRRFY..','.KFFFFFFK.','KFFKFFKFFK','KFFFFFFFFK','.KFFFFFFK.','..KRRRRK..','.KRRRRRRK.','KRRK..KRRK','...K..K...','..KK..KK..'
  ],
  frostMite: [
    '....BB....','...BWWB...','..BWNNWB..','.KBBBBBBK.','KBBKBBKBBK','KBBBBBBBBK','.KBBBBBBK.','..KNNNNK..','.KNNNNNNK.','KNNK..KNNK','...K..K...','..KK..KK..'
  ],

  'lever-off': [
    '..........','.....XX...','....XWWX..','...XWWX...','..K..X....','..K..X....','..KXXX....','..KTTK....','.KKTTKK...','..........'
  ],
  'lever-on': [
    '..........','..XX......','.XWWX.....','..XWWX....','....X..K..','....X..K..','....XXXK..','....KTTK..','...KKTTKK.','..........'
  ],
  'plate-off': [
    '..........','..........','..........','..KKKKKK..','.KXXXXXXK.','KXXXXXXXXK','KXXXXXXXXK','.KKKKKKKK.','..........','..........'
  ],
  'plate-on': [
    '..........','..........','..........','..KKKKKK..','.KUUQQUUK.','KUUQYYQUUK','KUUUUUUUUK','.KKKKKKKK.','..........','..........'
  ],
  'rune-gate-closed': [
    '.KKKKKKKK.','KUUUUUUUUK','KUQYUUYQUK','KUUYUUYUUK','KUYUUUUYUK','KUYUUUUYUK','KUUYUUYUUK','KUQYUUYQUK','KUUUUUUUUK','KUYUUUUYUK','KUUUUUUUUK','KKKKKKKKKK'
  ],
  'rune-gate-open': [
    '.KKKKKKKK.','KUUUUUUUUK','KU......UK','KU......UK','KU......UK','KU......UK','KU......UK','KU......UK','KU......UK','KU......UK','KUUUUUUUUK','KKKKKKKKKK'
  ],
  crate: [
    '..........','..KKKKKK..','.KTTTTTTK.','KTTKTTKTTK','KTTTKKTTTK','KTTTKKTTTK','KTTKTTKTTK','.KTTTTTTK.','..KKKKKK..','..........'
  ],
  'crate-broken': [
    '..........','..........','..K..K....','.KTT..TK..','..KKKK....','....KTTK..','.K......K.','..K....K..','..........','..........'
  ],
  npc: [
    '....KK....','...KSSK...','..KSSSSK..','..KSKSKK..','..KSSSSK..','...KSSK...','..KKGGKK..','.KGGGGGGK.','KGGGKKGGGK','...KGGK...','...K..K...','..KK..KK..'
  ],
  'npc-helped': [
    '....KK....','...KSSK...','..KSSSSK..','..KSKSKK..','..KSSSSK..','...KSSK...','..KKBBKK..','.KBBBBBBK.','KBBBKKBBBK','...KBBK...','...K..K...','..KK..KK..'
  ],
  'cycle-trap-active': [
    '..........','....YY....','...YFFY...','..YFXXFY..','.X..XX..X.','..X.XX.X..','...XXXX...','.XXXXXXXX.','..........','..........'
  ],
  'cycle-trap-safe': [
    '..........','..........','....UU....','...UQQU...','..UQYYQU..','...UQQU...','....UU....','..........','..........','..........'
  ],
  'push-block': [
    '..........','..KKKKKK..','.KXXXXXXK.','KXXKXXKXXK','KXXXXYXXXK','KXXXYYXXXK','KXXKXXKXXK','.KXXXXXXK.','..KKKKKK..','..........'
  ],
  'moving-platform': [
    '..........','..........','..KKKKKK..','.KUUQQUUK.','KUUYYYYUUK','KUUQYYQUUK','.KUUUUUUK.','..KKKKKK..','..........','..........'
  ],
  'quest-token': [
    '....YY....','...YWWY...','..YWUUWY..','.YWUQQUWY.','YWUQYYQUWY','.YWUQQUWY.','..YWUUWY..','...YWWY...','....YY....','..........'
  ],
  'rune-core': [
    '....YY....','...YWWY...','..YWUUWY..','.YWUQQUWY.','YWUQYYQUWY','.YWUQQUWY.','..YWUUWY..','...YWWY...','....YY....','..........'
  ],
  companion: [
    '....KK....','...KSSK...','..KSSSSK..','..KSKSKK..','..KSSSSK..','...KSSK...','..KKUUKK..','.KUUUUUUK.','KUUUKKUUUK','...KUUK...','...K..K...','..KK..KK..'
  ],
  stairs: [
    '..........','..........','......KKKK','....KKJJJK','..KKJJJJJK','KKJJJJJJJK','KJJJJJJJJK','KJJJJJJJJK','KKKKKKKKKK','..........'
  ],
  circuitGuardian: [
    '..KKKKKK..','.KXXXXXXK.','KXXUYYUXXK','KXXUUUUXXK','KXXYKKYXXK','.KXXUUXXK.','..KKXXKK..','.KXXYYXXK.','KXXYYYYXXK','KYYKKKKYYK','..KK..KK..','.KK....KK.'
  ],
  'chest-closed': [
    '..........','..........','..KKKKKK..','.KTTTTTTK.','KTTLLLLTTK','KTTTTTTTTK','KOOOOOOOOK','KOTTTTTTOK','KOTTYTTTOK','KOOOOOOOOK','.KKKKKKKK.'
  ],
  'chest-open': [
    '..KKKKKK..','.KTTTTTTK.','KTTLLLLTTK','KTTTTTTTTK','KKKKKKKKKK','..........','KOOOOOOOOK','KOTTTTTTOK','KOTTYTTTOK','KOOOOOOOOK','.KKKKKKKK.'
  ],
  exit: [
    '....YY....','...YWWY...','..YW..WY..','.YW.YY.WY.','YW.Y..Y.WY','YW.Y..Y.WY','.YW.YY.WY.','..YW..WY..','...YWWY...','....YY....'
  ],
  key: [
    '..........','....YY....','...YWWY...','...YWWY...','....YY....','....YK....','....YKK...','....Y.KK..','....Y.....','..........'
  ],
  'door-closed': [
    '.KKKKKKKK.','KOOOOOOOOK','KOTTTTTTOK','KOTTTTTTOK','KOTTTTTTOK','KOTTTYYTOK','KOTTTYYTOK','KOTTTTTTOK','KOTTTTTTOK','KOTTTTTTOK','KOOOOOOOOK','KKKKKKKKKK'
  ],
  'door-open': [
    '.KKKKKKKK.','KOOOOOOOOK','KO......OK','KO......OK','KO......OK','KO......OK','KO......OK','KO......OK','KO......OK','KO......OK','KOOOOOOOOK','KKKKKKKKKK'
  ],
  'trap-active': [
    '..........','..........','..........','.X..X..X..','..X.X.X...','...XXX....','.XXXXXXX..','..........','..........','..........'
  ],
  'trap-safe': [
    '..........','..........','..........','..ZZZZZZ..','.Z......Z.','.Z..GG..Z.','.Z.GGGG.Z.','..ZZZZZZ..','..........','..........'
  ],
  torch: [
    '...Y....','..YFY...','...F....','...R....','..KKK...','...T....','...T....','...T....','..OOO...'
  ],
  potion: [
    '...KKK....','...KXK....','..KKXKK...','..KBBBBK..','.KBBBBBBK.','KBBWWBBBBK','KBBBBBBBBK','.KBBBBBBK.','..KKKKKK..'
  ],

  antidote: [
    '...KKK....','...KXK....','..KKXKK...','..KGGGGK..','.KGIIGGGK.','KGGWWGGGGK','KGGGGGGGGK','.KGGGGGGK.','..KKKKKK..'
  ],
  ward: [
    '...KKK....','...KXK....','..KKXKK...','..KUUUUK..','.KUQQUUUK.','KUUWWUUUUK','KUUUUUUUUK','.KUUUUUUK.','..KKKKKK..'
  ],
  guardCape: [
    '....KK....','...KRRK...','..KRRRRK..','.KRRRRRRK.','KRRRRRRRRK','KRRRRRRRRK','.KRRRRRRK.','..KRRRRK..','...KRRK...','....KK....'
  ],
  alchemistApron: [
    '...KKKK...','..KBBBBK..','.KBBWWBBK.','KBBBBBBBBK','KBBYBBYBBK','.KBBBBBBK.','..KBBBBK..','..KBBBBK..','.KK....KK.'
  ],
  signalCharm: [
    '....YY....','...YWWY...','..YWUUWY..','.YWUYYUWY.','YWUYYYYUWY','.YWUYYUWY.','..YWUUWY..','...YWWY...','....YY....'
  ],
  wardenCrest: [
    '....UU....','...UQQU...','..UQYYQU..','.UQYWWYQU.','UQYWWWWYQU','.UQYWWYQU.','..UQYYQU..','...UQQU...','....UU....'
  ],
  sunHerb: [
    '....Y.....','..Y.Y.Y...','...YYY....','.YYYGYYY..','...YGY....','....G.....','...GGG....','..GGGGG...','....G.....','....G.....'
  ],
  moonBerry: [
    '....G.....','...GGG....','..G..G....','..U.U.U...','.UQUQUQU..','..UQUQU...','...UQU....','....U.....','..........','..........'
  ],
  waterCrystal: [
    '....B.....','...BWB....','..BWWWB...','.BWWWWWB..','BWWBWWWWB.','.BWWWWWB..','..BWWWB...','...BBB....','..........','..........'
  ],
  emberRoot: [
    '....F.....','...FYF....','..FYFYF...','...FFF....','....O.....','...OOO....','..OOTOO...','...OTO....','....O.....','..........'
  ],
  trainingBlade: [
    '.......X..','......XW..','.....XW...','....XW....','...XW.....','..XW......','.KX.......','KTTK......','.KK.......','..........'
  ],
  bronzeBlade: [
    '.......L..','......LT..','.....LT...','....LT....','...LT.....','..LT......','.KL.......','KTTK......','.KK.......','..........'
  ],
  clockworkBlade: [
    '.......Y..','......YX..','.....YX...','....YX....','...YX.....','..YX......','.KY.......','KUUUK.....','.KK.......','..........'
  ],
  emberWand: [
    '.......F..','......FY..','.....FY...','....FY....','...FY.....','..FY......','.KF.......','KTTK......','.KK.......','..........'
  ],
  frostScepter: [
    '.......B..','......BW..','.....BW...','....BW....','...BW.....','..BW......','.KB.......','KXXK......','.KK.......','..........'
  ],
  seekerLens: [
    '....YY....','...YWWY...','..YWBBWY..','.YWBBBBWY.','YWBBKKBBWY','.YWBBBBWY.','..YWBBWY..','...YWWY...','....YY....'
  ]
});

// World frames (redesign slice 01) win over legacy frames of the same id; item icons stay legacy.
const SPRITES = Object.freeze({ ...LEGACY, ...WORLD_SPRITES });
const charsFor = id => Object.prototype.hasOwnProperty.call(WORLD_SPRITES, id) ? WORLD_CHARS : P;

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = CQ_HEX[color];
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawBitmap(ctx, bitmap, x, y, scale, options = {}, chars = P) {
  const accent = options.accent == null ? C.cyan : options.accent;
  const accentDark = DARK[accent] == null ? accent : DARK[accent];
  const flip = !!options.flip;
  for (let row = 0; row < bitmap.length; row++) {
    const line = bitmap[row];
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      if (char === '.' || char === ' ') continue;
      const color = char === 'A' ? accent : char === 'a' && chars === WORLD_CHARS ? accentDark : chars[char];
      if (color == null) continue;
      const px = flip ? line.length - 1 - col : col;
      rect(ctx, color, x + px * scale, y + row * scale, scale, scale);
    }
  }
}

export function spriteBitmap(id) { return SPRITES[id] || SPRITES['hero-idle']; }
/** The palette-key map a frame is drawn with ('A' accent and, for world frames, 'a' accent shade, are extra). */
export function spriteChars(id) { return charsFor(SPRITES[id] ? id : 'hero-idle'); }

export function spriteSize(id, scale = 1) {
  const bitmap = spriteBitmap(id);
  return { width: (bitmap[0] || '').length * scale, height: bitmap.length * scale };
}

export function drawSprite(ctx, id, x, y, scale = 2, options = {}) {
  const key = SPRITES[id] ? id : 'hero-idle';
  drawBitmap(ctx, SPRITES[key], x, y, scale, options, charsFor(key));
}

const iconCache = new Map();
export function spriteURL(id, accentHex = '#39d0c8') {
  const mapped = id === 'dungeonKey' ? 'key' : id;
  const cacheKey = mapped + ':' + accentHex;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
  if (typeof document === 'undefined') return '';
  const key = SPRITES[mapped] ? mapped : 'potion';
  const bitmap = SPRITES[key];
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const scale = Math.max(1, Math.floor(Math.min(30 / (bitmap[0] || '').length, 30 / bitmap.length)));
  const x = Math.floor((32 - (bitmap[0] || '').length * scale) / 2), y = Math.floor((32 - bitmap.length * scale) / 2);
  drawBitmap(ctx, bitmap, x, y, scale, { accent: nearestIndex(accentHex) }, charsFor(key));
  const url = canvas.toDataURL(); iconCache.set(cacheKey, url); return url;
}

export const CODEQUEST_SPRITE_IDS = Object.freeze(Object.keys(SPRITES));
