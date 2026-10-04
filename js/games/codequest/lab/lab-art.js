/* Laboratory of Curiosity sprites (lab design D3): code-drawn pixel bitmaps in the
   Code Quest palette. One char = one logical pixel; '.' is transparent. Rows shorter
   than the widest row are padded, so a hand-typed frame can never shear. */
import { CQ_HEX, Q } from '../palette.js';

const CH = Object.freeze({
  K: Q.outline, R: Q.red, W: Q.white, S: Q.sand, L: Q.sandLit, Y: Q.yellow, F: Q.lava,
  Q: Q.lilac, U: Q.purple, M: Q.magenta, V: Q.purpleDark, G: Q.green, H: Q.greenDark,
  I: Q.greenLit, C: Q.ice, B: Q.cyan, O: Q.woodDark, T: Q.wood, N: Q.snowShade, X: Q.steel,
  P: Q.pink, Z: Q.grey, D: Q.rockDark, E: Q.stoneMid, J: Q.stoneLit
});

const frame = rows => {
  const width = Math.max(...rows.map(row => row.length));
  return Object.freeze(rows.map(row => row.padEnd(width, '.')));
};

export const LAB_SPRITES = Object.freeze({
  redMushroom: frame([
    '....KKKK....', '..KKRRRRKK..', '.KRRWRRRWRK.', 'KRRRRRRRRRRK', 'KRWRRRRRRWRK', '.KKKKKKKKKK.',
    '....KLLK....', '....KSSK....', '....KSSK....', '...KSSSSK...', '...KKKKKK...'
  ]),
  echoCrystal: frame([
    '.....KK.....', '....KQUK....', '...KQUUK.K..', '...KQUUKKQK.', '.K.KQUUKQUK.', 'KQKKQUUKQUK.',
    'KQUKQUUKUUK.', 'KQUKQUUKUK..', '.KUKQUUKKK..', '..KKUUUUK...', '...KKKKKK...'
  ]),
  emberSeed: frame([
    '.....Y......', '....YFY.....', '....FRF.....', '...KKKKK....', '..KFFFFFK...', '.KFFYFFFFK..',
    '.KFFFFFFRK..', '.KFFFFFRRK..', '..KFFRRRK...', '...KRRRK....', '....KKK.....'
  ]),
  moonflower: frame([
    '....KKKK....', '..KKWWWWKK..', '.KWWQWWQWWK.', '.KWQWYYWQWK.', 'KWWWYYYYWWWK', '.KWQWYYWQWK.',
    '.KWWQWWQWWK.', '..KKWWWWKK..', '....KGGK....', '...KGKKGK...', '....KGGK....'
  ]),
  voidDust: frame([
    '....M.......', '...MUM...M..', '....M...MUM.', '..........M.', '....KKKK....', '..KKVVVVKK..',
    '.KVVUVVVUVK.', 'KVVVVVMVVVVK', 'KVUVVVVVVUVK', '.KKKKKKKKKK.'
  ]),
  lifeSap: frame([
    '.....KK.....', '....KIIK....', '....KIGK....', '...KIGGGK...', '...KIGGGK...', '..KIGGGGGK..',
    '..KIWGGGGK..', '.KIGGGGGGHK.', '.KIGGGGGHHK.', '..KGGGGHHK..', '...KKKKKK...'
  ]),
  frostDew: frame([
    '.....KK.....', '....KWWK....', '....KWCK....', '...KWCCCK...', '...KWCCCK...', '..KWCCBCCK..',
    '..KWWCCCCK..', '.KWCCCCCBNK.', '.KWCCCCBNNK.', '..KCCCCNNK..', '...KKKKKK...'
  ]),
  starDust: frame([
    '.....KK.....', '....KYYK....', '....KYYK....', 'KKKKKYYKKKKK', 'KYYYYWYYYYYK', '.KYYYYYYYYK.',
    '..KYYYYYYK..', '..KYYKKYYK..', '.KYYK..KYYK.', '.KYK....KYK.', '.KK......KK.'
  ]),
  owl: frame([
    '........KK..........', '.......KUUK.........', '......KUUUUK........', '.....KUUYUUUK.......',
    '....KUUUUUUUUK......', '..KKUUUUUUUUUUKK....', '.KUUUUUUUUUUUUUUK...', '..KKKKKKKKKKKKKK....',
    '...KTTTTTTTTTTK.....', '..KTSSSSTTSSSSTK....', '..KTSWWSTTSWWSTK....', '..KTWWKWTTWKWWTK....',
    '..KTSWWSTTSWWSTK....', '..KTTSSTYYTSSTTK....', '..KTTTTTTYTTTTTK....', '..KOTSSSSSSSSTOK....',
    '..KOTSLSLSLSSTOK....', '..KOTSSSSSSSSTOK....', '..KOTSLSLSLSSTOK....', '...KOTSSSSSSTOK.....',
    '....KKTTTTTTKK......', '.....KYK..KYK.......'
  ]),
  owlBlink: null,
  cat: frame([
    '....K.K.................', '...KVKVK................', '..KVVVVVK..KKKKKKK......', '..KVKVKVKKKVVVVVVVKK....',
    '..KVVVVVVVVVVVVVVVVVK...', '...KVVPVVVVVVVVVVVVVVK..', '...KVVVVVVVVVVVVVVVVVK..', '....KKVVVVVVVVVVVVVVVK..',
    '......KVVVVVVVVVVVVVK...', '......KKKKKKKKKKKKKK....'
  ]),
  catAwake: null
});

// Variants: same frame with the eyes changed, so the two never drift apart.
const swapRows = (rows, at, lines) => frame(rows.map((row, i) => (i >= at && i < at + lines.length ? lines[i - at] : row)));
const SPRITES = {
  ...LAB_SPRITES,
  owlBlink: swapRows(LAB_SPRITES.owl, 10, ['..KTSSSSTTSSSSTK....', '..KTKKKKTTKKKKTK....', '..KTSSSSTTSSSSTK....']),
  catAwake: swapRows(LAB_SPRITES.cat, 3, ['..KVYVYVKKKVVVVVVVKK....'])
};

export function px(ctx, color, x, y, w = 1, h = 1) {
  ctx.fillStyle = CQ_HEX[color];
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function labSpriteSize(id) {
  const rows = SPRITES[id];
  return rows ? { width: rows[0].length, height: rows.length } : { width: 0, height: 0 };
}

/** Draws a lab bitmap at logical (x, y); `outline` recolours the K pixels (selection glow). */
export function drawLabSprite(ctx, id, x, y, options = {}) {
  const rows = SPRITES[id];
  if (!rows) return;
  const flip = !!options.flip;
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      if (char === '.') continue;
      const color = char === 'K' && options.outline != null ? options.outline : CH[char];
      if (color == null) continue;
      px(ctx, color, x + (flip ? line.length - 1 - col : col), y + row);
    }
  }
}

export const LAB_SPRITE_IDS = Object.freeze(Object.keys(SPRITES));
