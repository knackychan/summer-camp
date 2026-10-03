/* Code Quest world atlas (redesign slice 01): 16×24 actors, 16×16 props, drawn
   for the high 3/4 top-down camera. Frames are strings of palette keys; WORLD_CHARS
   maps each key to a Code Quest palette index (codequest/palette.js). 'A' is the
   kid's accent colour and 'a' its one-step-darker shade. Item icons (potions,
   ingredients, gear) still live in pixel-art.js — the potion/Camp area is deferred. */
import { Q } from './palette.js';

export const WORLD_CHARS = Object.freeze({
  K: Q.outline, k: Q.deep, '1': Q.stoneDark, '2': Q.stone, '3': Q.stoneMid, '4': Q.stoneLit,
  E: Q.skin, e: Q.skinShade, T: Q.wood, t: Q.woodDark, S: Q.sand, s: Q.sandLit,
  W: Q.white, n: Q.snowShade, X: Q.steel, Y: Q.yellow, O: Q.lava, R: Q.red, r: Q.rock,
  G: Q.green, g: Q.greenDark, I: Q.greenLit, B: Q.cyan, b: Q.oceanLit, c: Q.ocean, i: Q.ice,
  U: Q.purple, u: Q.purpleDark, Q: Q.lilac
});

const blank = width => '.'.repeat(width);
/** Left halves → symmetric frames. */
const mirror = rows => rows.map(row => row + [...row].reverse().join(''));
/** Mirror a whole frame left↔right. */
const flipH = rows => rows.map(row => [...row].reverse().join(''));
/** Pad a frame at the top to `height` rows. */
const padTop = (rows, height) => [...Array(Math.max(0, height - rows.length)).fill(blank(rows[0].length)), ...rows];
/** Replace whole rows: { rowIndex: 'row' }. */
const patch = (rows, changes) => rows.map((row, i) => changes[i] != null ? changes[i] : row);
/** Stamp `part` (transparent '.') onto `rows` at x, y. */
function stamp(rows, part, x, y) {
  return rows.map((row, r) => {
    const src = part[r - y];
    if (src == null) return row;
    const chars = [...row];
    for (let c = 0; c < src.length; c++) if (src[c] !== '.' && x + c >= 0 && x + c < chars.length) chars[x + c] = src[c];
    return chars.join('');
  });
}
/** Swap palette keys: { from: to }. */
const recolor = (rows, map) => rows.map(row => [...row].map(ch => map[ch] || ch).join(''));
/** One-pixel idle bob: everything above `row` drops by one pixel, row `row` is absorbed. */
const bob = (rows, row) => [blank(rows[0].length), ...rows.slice(0, row), ...rows.slice(row + 1)];

/* ---------- hero ---------- */
const HERO_S = mirror([
  '........', '........', '........', '.....KKK', '....KTTT', '...KTTtT', '...KTtEE', '...KtEEE',
  '...KEEKE', '...KEEKE', '...KeEEE', '....KeEE', '....KKAA', '..KKaAAA', '.KEKaAAA', '.KEKaAAA',
  '.KeKtttY', '..KKaAAA', '...KaAAA', '....KXXK', '....KXXK', '....KttK', '...KtttK', '...KKKKK'
]);
const HERO_N = mirror([
  '........', '........', '........', '.....KKK', '....KTTT', '...KTTtT', '...KTtTT', '...KtTTT',
  '...KTTtT', '...KTtTT', '...KtTTt', '....KtTT', '....KKaa', '..KKaaAA', '.KEKaAaA', '.KEKaAaA',
  '.KeKaAaA', '..KKaAaA', '...KaaaA', '....KXXK', '....KXXK', '....KttK', '...KtttK', '...KKKKK'
]);
const HERO_E = [
  '................', '................', '................', '......KKKKK.....',
  '.....KTTTTTK....', '....KTTTTTtTK...', '....KTTTtEEEK...', '....KTTtEEEEEK..',
  '....KTtEEEEKEK..', '....KTtEEEEKEK..', '....KttEEEEEEEK.', '.....KteEEEeKK..',
  '.....KKAAAAK....', '....KaKXXXXK....', '...KaKXnnnnXK...', '...KaKXnAAnXK...',
  '...KaKXnAAnXK...', '....KKXnnnnXK...', '....KaKXXXXK....', '.....KXXXXK.....',
  '.....KXKKXK.....', '.....KtKKtK.....', '.....KttKKttK...', '.....KKK.KKKK...'
];
const LEGS_S_1 = { 19: '....KXXKKXXK....', 20: '....KXXKKXXK....', 21: '....KttKKttK....', 22: '...KtttKKKKK....', 23: '...KKKKK........' };
const LEGS_S_2 = { 19: '....KXXKKXXK....', 20: '....KXXKKXXK....', 21: '....KttKKttK....', 22: '....KKKKKtttK...', 23: '........KKKKK...' };
const LEGS_E_1 = { 19: '.....KXXXXK.....', 20: '....KXK..KXK....', 21: '....KtK..KtK....', 22: '...KttK..KttK...', 23: '...KKK...KKKK...' };
const LEGS_E_2 = { 19: '.....KXXXXK.....', 20: '......KXXK......', 21: '......KttK......', 22: '.....KttttK.....', 23: '.....KKKKKK.....' };

const SWORD_DOWN = ['KYK', 'KWK', 'KWK', 'KnK', 'KnK', '.K.'];
const SWORD_UP = ['.K.', 'KWK', 'KWK', 'KnK', 'KnK', 'KYK'];
const SWORD_SIDE = ['.K...', 'KYWWW', '.K...'];

const HERO = {
  'hero-s-idle': HERO_S,
  'hero-s-walk-1': patch(HERO_S, LEGS_S_1),
  'hero-s-walk-2': patch(HERO_S, LEGS_S_2),
  'hero-s-attack': stamp(HERO_S, SWORD_DOWN, 0, 17),
  'hero-s-hurt': patch(HERO_S, { 8: '...KEKEEEEKEK...', 9: '...KEEKEEKEEK...', 11: '....KeKKKKeK....' }),
  'hero-n-idle': HERO_N,
  'hero-n-walk-1': patch(HERO_N, LEGS_S_1),
  'hero-n-walk-2': patch(HERO_N, LEGS_S_2),
  'hero-n-attack': stamp(HERO_N, SWORD_UP, 13, 6),
  'hero-n-hurt': bob(HERO_N, 12),
  'hero-e-idle': HERO_E,
  'hero-e-walk-1': patch(HERO_E, LEGS_E_1),
  'hero-e-walk-2': patch(HERO_E, LEGS_E_2),
  'hero-e-attack': stamp(HERO_E, SWORD_SIDE, 11, 13),
  'hero-e-hurt': patch(HERO_E, { 8: '....KTtEEEEEEK..', 9: '....KTtEEEKKEK..' })
};

/* ---------- enemies ---------- */
const GOBLIN = mirror([
  '........', '........', '........', '........', '........', '........', '........', '.....KKK',
  'K...KGGG', 'KK.KGGGG', 'KGKGGIGG', '.KGGYKGG', '..KGGGGG', '..KgGKKG', '...KgGGG', '...KKRRR',
  '..KGKRRR', '..KGKrRR', '..KgKRRR', '...KKttt', '....KggK', '....KggK', '...KtttK', '...KKKKK'
]);
const ARCHER = stamp(mirror([
  '........', '........', '........', '........', '.....KKK', '....KuuU', '...KuUUU', '...KuUKK',
  '...KuKEE', '...KuKYE', '...KuKEE', '...KuKee', '..KuUUKK', '..KuUUUU', '.KEKuUUU', '.KEKuUUU',
  '.KeKtttt', '..KKuUUU', '...KuUUU', '...KuuuU', '....KttK', '....KttK', '...KtttK', '...KKKKK'
]), ['.KK', 'KTK', 'KTn', 'KTn', 'KTn', 'KTn', 'KTn', 'KTn', 'KTn', 'KTK', '.KK'], 13, 9);
const BULWARK = stamp(mirror([
  '........', '........', '........', '......KR', '.....KRR', '.....KKK', '....KXXX', '...KXnXX',
  '...KXXXX', '...KXKKK', '...KXKYK', '...KXXXX', '..KKKXXX', '.KXXKXXX', '.KXnKXXX', '.KXXKXXX',
  '.KXXKttt', '.KXXKXXX', '..KKKXXX', '...KXXXX', '....KXXK', '....KXXK', '...KtttK', '...KKKKK'
]), ['KKKKKKK', 'KXnnnXK', 'KXnRnXK', 'KXRRRXK', 'KXnRnXK', 'KXnRnXK', 'KXnnnXK', '.KXnXK.', '..KXK..', '...K...'], 0, 12);
const EMBER_IMP = mirror([
  '........', '........', '........', '........', '........', '.......Y', '......YO', '.....YOO',
  '..K.YOOO', '..KKROOO', '...KRRRR', '...KRYKR', '...KRRRR', '...KrRKK', '....KrRR', '....KKRR',
  '..KOKRRR', '..KOKRRR', '...KKrRR', '....KrRR', '....KrrK', '....KRRK', '...KRRRK', '...KKKKK'
]);
const FROST_MITE = mirror([
  '........', '........', '........', '........', '........', '.......K', '......KW', '.....KWi',
  '....KWii', '...KBBii', '..KBBBBi', '..KBKKBB', '..KBBBBB', '..KcBBBB', '...KcBBB', '...KKcBB',
  '..KiKcBB', '..KiKccB', '...KKccB', '....KccK', '....KbbK', '....KbbK', '...KbbbK', '...KKKKK'
]);
const SLIME = mirror([
  '........', '........', '........', '........', '........', '........', '......KK', '....KKGG',
  '...KGGIG', '..KGGIIG', '..KGGGGG', '.KGGKGGG', '.KGGKGGG', '.KgGGGGG', '..KggGGG', '...KKKKK'
]);
const SLIME_SQUASH = mirror([
  '........', '........', '........', '........', '........', '........', '........', '.....KKK',
  '...KKGGG', '..KGGIIG', '.KGGGGGG', '.KGGKGGG', 'KGGGKGGG', 'KgGGGGGG', '.KggGGGG', '..KKKKKK'
]);
const VIPER = [
  '................', '................', '................', '................',
  '..........KKKK..', '.........KGGGGK.', '.........KGYKGK.', '.........KGGGGKR',
  '..........KGGK..', '....KKKKKKGGK...', '...KGGIGIGGK....', '..KGgKKKKKgGK...',
  '..KGGIGIGIGGK...', '...KggGGGGggK...', '....KKKKKKKK....', '................'
];
const GOLEM = mirror([
  '............', '............', '.......KKKKK', '......K44443', '.....K443333', '.....K4YK333', '.....K433333', '..KKKKK33333',
  '.K44433K2222', 'K443333K2G22', 'K433333K2222', 'K433333K2222', 'K3333K3K22G2', '.KKKKK3K2222', '.K443K3K2222', '.K433K3K1111',
  '.K333K3K1111', '..KKKKKKKKKK', '....K44433K.', '....K43333K.', '....K33333K.', '....K32222K.', '...K322222K.', '...KKKKKKKK.'
]);
const RUNE_WARDEN = mirror([
  '............', '..........KK', '.........KUU', '........KUUQ', '.......KUUUQ', '......KUUUUU', '......KUuKKK', '......KuKYKK',
  '......KuKKKK', '.....KUUuKKK', '...KKUUUUUUU', '..KQKUUUYUUU', '.KQQKUUUUUUU', '.KQQKUUuYUUu', '..KKKUUUUUUU', '....KUUUuUUU',
  '....KUUUUUUU', '...KUUUuUUUU', '...KUUUUUUUU', '..KUUUuUUUUU', '..KUUUUUUUUU', '.KuuuuuuuuuU', '.Kuuuuuuuuuu', '.KKKKKKKKKKK'
]);
const CIRCUIT_GUARDIAN = mirror([
  '............', '............', '........KKKK', '.......KXXXX', '......KXnnnX', '......KXKKKK', '......KXKBBB', '......KXKKKK',
  '.......KXXXX', '...KKKKKXXYX', '..KXXXKXXYYY', '.KXnXXKXXXYX', '.KXXXXKXXXXX', '.KXXXXKXYXXX', '.KXXXXKXYXXX', '..KKKKKXYYYY',
  '......KXXXXX', '......KKKKKK', '.....KXXK...', '.....KXXK...', '.....KXXK...', '....KXXXK...', '....KXXXK...', '....KKKKK...'
]);
const RELIC_HYDRA = mirror([
  '..............KK', '..KKKK.......KUU', '.KUUUUK.....KUUU', 'KUYKUUK.....KUYK', 'KUUUUUK.....KUUU', '.KUUQUK......KUU', '..KUUK.......KUU', '..KUUK.......KUU',
  '...KUUK.....KUUU', '...KUUUK...KUUUU', '....KUUUKKKUUUUU', '....KUUUUUUUUUUU', '...KuUUUUUUUUQUU', '...KuUUUQUUUUUUU', '..KuuUUUUUUUQUUU', '..KuuUUUUUUUUUUU',
  '..KuuuUUUUUUUUUU', '..KuuuuUUUUUUUUU', '...KuuuuuuuuuUUU', '....KKuuuuuuuuuu', '.....KuuK...KuuK', '.....KuuK...KuuK', '....KuuuK..KuuuK', '....KKKKK..KKKKK'
]);
const COMPANION = mirror([
  '........', '........', '.......K', '......KU', '.....KUU', '....KUUU', '...KUUUU', '..KKKKKK',
  '...KTTTT', '..KTWWWT', '..KTWKWT', '..KTWWWT', '..KTTTTY', '...KTTTT', '..KTKtss', '.KTTKtss',
  '.KTtKtss', '..KtKtts', '...KKttt', '...KUUUU', '...KuUUU', '...KuuUU', '....KYYK', '....KKKK'
]);
const NPC = recolor(HERO_S, { A: 'G', a: 'g', T: 'S', t: 'T' });

const ENEMIES = {
  slime: SLIME, 'slime-0': SLIME, 'slime-1': SLIME_SQUASH,
  goblin: GOBLIN, 'goblin-0': GOBLIN, 'goblin-1': bob(GOBLIN, 14),
  archer: ARCHER, 'archer-0': ARCHER, 'archer-1': bob(ARCHER, 12),
  bulwark: BULWARK, 'bulwark-0': BULWARK, 'bulwark-1': bob(BULWARK, 12),
  emberImp: EMBER_IMP, 'emberImp-0': EMBER_IMP, 'emberImp-1': bob(EMBER_IMP, 13),
  frostMite: FROST_MITE, 'frostMite-0': FROST_MITE, 'frostMite-1': bob(FROST_MITE, 14),
  viper: VIPER, 'viper-0': VIPER, 'viper-1': patch(VIPER, { 7: '.........KGGGGK.' }),
  golem: GOLEM, 'golem-0': GOLEM, 'golem-1': bob(GOLEM, 17),
  runeWarden: RUNE_WARDEN, 'runeWarden-0': RUNE_WARDEN, 'runeWarden-1': bob(RUNE_WARDEN, 14),
  circuitGuardian: CIRCUIT_GUARDIAN, 'circuitGuardian-0': CIRCUIT_GUARDIAN, 'circuitGuardian-1': bob(CIRCUIT_GUARDIAN, 17),
  relicHydra: RELIC_HYDRA, 'relicHydra-0': RELIC_HYDRA, 'relicHydra-1': bob(RELIC_HYDRA, 10),
  companion: COMPANION, npc: NPC, 'npc-helped': recolor(NPC, { G: 'B', g: 'c' })
};

/* ---------- props (16×16 unless noted) ---------- */
const P16 = rows => padTop(rows, 16);
const CHEST_BODY = ['.KTTYTTTTTTYTTK.', '.KTTYTTTTTTYTTK.', '.KttYttttttYttK.', '.KttYttttttYttK.', '.KKKKKKKKKKKKKK.'];
const CHEST_CLOSED = P16([
  '................', '................', '................', '..KKKKKKKKKKKK..', '.KTTYTTTTTTYTTK.', '.KTTYTTTTTTYTTK.',
  '.KttYttttttYttK.', '.KKKKKKYYKKKKKK.', '.KTTYTKYYKTYTTK.', '.KTTYTKYKKTYTTK.', '.KTTYTTKKTTYTTK.',
  '.KttYttttttYttK.', '.KttYttttttYttK.', '.KKKKKKKKKKKKKK.', '..k..........k..', '................'
]);
const CHEST_OPEN = P16([
  '..KKKKKKKKKKKK..', '.KTTYTTTTTTYTTK.', '.KttYttttttYttK.', '.KKKKKKKKKKKKKK.', '.KkkkkkkkkkkkkK.', '.KkYYsYYYsYYkkK.',
  '.KYsYYYsYYYsYYK.', '.KKKKKKKKKKKKKK.', ...CHEST_BODY.slice(0, 4), '.KttYttttttYttK.', '.KKKKKKKKKKKKKK.', '..k..........k..', '................'
]);
const KEY = P16([
  '................', '................', '................', '................', '......KKKK......', '.....KYYYYK.....',
  '.....KYKKYK.....', '.....KYYYYK.....', '......KYYK......', '.......KYK......', '.......KYKK.....',
  '.......KYYYK....', '.......KYK......', '.......KYYK.....', '........KK......', '................'
]);
const TRAP_ACTIVE = P16([
  '................', '................', '................', '................', '................', '................',
  '...K...K...K....', '..KnK.KnK.KnK...', '..KnK.KnK.KnK...', '.KXnXKXnXKXnXK..', '.K11111111111K..', '.KKKKKKKKKKKKK..'
]);
const TRAP_SAFE = P16([
  '.KKKKKKKKKKKKK..', '.K1k1k1k1k1k1K..', '.KKKKKKKKKKKKK..'
]);
const CYCLE_ACTIVE = P16(mirror([
  '........', '........', '........', '.......Y', '......YO', '.....YOO', '....YOOR', '....YORR',
  '.....YOR', '..KKKKYO', '.K11K1K1', '.KKKKKKK'
]));
const CYCLE_SAFE = P16(mirror(['..KKKKKK', '.K11K1KO', '.KKKKKKK']));
const LEVER_OFF = P16([
  '................', '................', '................', '..KK............', '.KRRK...........', '.KRRK...........',
  '..KXK...........', '...KXK..........', '....KXK.........', '.....KXK........', '......KXK.......',
  '....KKKKKKKK....', '...K33333333K...', '...K22222222K...', '...KKKKKKKKKK...', '................'
]);
const LEVER_ON = recolor(flipH(LEVER_OFF), { R: 'I' });
const PLATE_OFF = P16(['...KKKKKKKKKK...', '..K3333333333K..', '..K2222222222K..', '...KKKKKKKKKK...', '................', '................']);
const PLATE_ON = P16(['................', '...KKKKKKKKKK...', '..KUQQQQQQQQUK..', '...KKKKKKKKKK...', '................', '................']);
const CRATE = P16([
  '................', '................', '..KKKKKKKKKKKK..', '..KSTTTTTTTTSK..', '..KTtKTTTTKtTK..', '..KTTtKTTKtTTK..',
  '..KTTTtKKtTTTK..', '..KTTTKttKTTTK..', '..KTTKtTTtKTTK..', '..KTKtTTTTtKTK..', '..KStTTTTTTtSK..',
  '..KKKKKKKKKKKK..', '..KttttttttttK..', '..KttttttttttK..', '..KKKKKKKKKKKK..', '................'
]);
const CRATE_BROKEN = P16([
  '...KTTK...KTK...', '..KTtK..KTTTK...', '....KK.KTtK.KTK.', '..KTTTK.KK..KK..', '................', '................'
]);
const PUSH_BLOCK = P16([
  '................', '................', '..KKKKKKKKKKKK..', '..K4444444444K..', '..K4333333332K..', '..K4333YY3332K..',
  '..K433YYYY332K..', '..K4333YY3332K..', '..K4333333332K..', '..K4222222222K..', '..KKKKKKKKKKKK..',
  '..K2222222222K..', '..K1111111111K..', '..KKKKKKKKKKKK..', '................', '................'
]);
const PLATFORM = P16(['..KKKKKKKKKKKK..', '.KUQQQQQQQQQQUK.', '.KUUUYUUUUYUUUK.', '.KuuuuuuuuuuuuK.', '..KKKKKKKKKKKK..', '................', '................']);
const COIN = [
  '................', '................', '................', '......KKKK......', '....KKYYYYKK....', '...KYYssssYYK...',
  '..KYsYYYYYYsYK..', '..KYYYYWWYYYYK..', '..KYYYWWWWYYYK..', '..KYYYYWWYYYYK..', '..KYYYYYYYYOYK..',
  '...KYYYYYYOOK...', '....KKYYYYKK....', '......KKKK......', '................', '................'
];
const EXIT = P16([
  '.....KKKKKK.....', '...KKBBBBBBKK...', '..KBBiiiiiiBBK..', '.KBiiWWWWWWiiBK.', '.KBiWWWWWWWWiBK.',
  '.KBiiWWWWWWiiBK.', '..KBBiiiiiiBBK..', '...KKBBBBBBKK...', '.....KKKKKK.....', '................'
]);
const STAIRS = P16([
  '................', '................', '.KKKKKKKKKKKKKK.', '.K444444444444K.', '.K111111111111K.', '.K333333333333K.',
  '.K222222222222K.', '.KkkkkkkkkkkkkK.', '.K111111111111K.', '.KkkkkkkkkkkkkK.', '.KKKKKKKKKKKKKK.',
  '................', '................', '................', '................', '................'
]);

const frame24 = inner => [
  '..KKKKKKKKKKKK..', '.K444444444444K.', '.K4KKKKKKKKKK3K.',
  ...inner.map(row => '.K4K' + row + 'K3K.'),
  '.K4KKKKKKKKKK3K.', '.K333333333333K.', '.KKKKKKKKKKKKKK.'
];
const DOOR_IN = Array.from({ length: 18 }, (_, i) => i === 3 || i === 13 ? 'XXXXXXXX' : i === 9 ? 'TTtYYtTT' : 'TTtTTtTT');
const DOOR_CLOSED = frame24(DOOR_IN);
const DOOR_OPEN = frame24(Array.from({ length: 18 }, () => 'Tkkkkkkk'));
const GATE_CLOSED = frame24(Array.from({ length: 18 }, (_, i) => i === 8 ? 'QUKYYKQU' : 'QUKQUKQU'));
const GATE_OPEN = frame24(Array.from({ length: 18 }, (_, i) => i < 2 ? 'QUKQUKQU' : 'kkkkkkkk'));

/* ---------- decor ---------- */
const TORCH_BASE = ['..KKKK..', '..KXXK..', '...KK...', '...tK...', '...tK...', '..KKKK..', '........', '........', '........', '........'];
const TORCH = [...['...Y....', '..YOY...', '.YOOOY..', '.YORROY.', '..YRRY..', '...YY...'], ...TORCH_BASE];
const TORCH_1 = [...['....Y...', '...YOY..', '..YOOOY.', '.YORROY.', '..YRRY..', '...YY...'], ...TORCH_BASE];
const BANNER = [
  'KKKKKKKK', 'KRRRRRRK', 'KRRRRRRK', 'KRRYYRRK', 'KRYRRYRK', 'KRRYYRRK', 'KRRRRRRK', 'KrRRRRrK',
  'KRRRRRRK', 'KrRRRRrK', 'KRRRRRRK', 'KRRKKRRK', 'KRK..KRK', 'KK....KK', '........', '........'
];
const RUBBLE = P16(['....KK..........', '...K33K..KKK....', '..K3443KK333K...', '..KK22KK2222K...', '...KK.KKKKK.....']);
const SKULL = P16(['......KKKK......', '.....KWWWWK.....', '.....KKWWKK.....', '.....KnWWnK.....', '......KnnK......', '......KKKK......', '................']);

export const WORLD_SPRITES = Object.freeze({
  ...HERO,
  // Legacy ids keep working for older callers and icons.
  'hero-idle': HERO['hero-s-idle'], 'hero-walk-1': HERO['hero-s-walk-1'], 'hero-walk-2': HERO['hero-s-walk-2'],
  'hero-attack': HERO['hero-s-attack'], 'hero-hurt': HERO['hero-s-hurt'],
  ...ENEMIES,
  'chest-closed': CHEST_CLOSED, 'chest-open': CHEST_OPEN, key: KEY,
  'trap-active': TRAP_ACTIVE, 'trap-safe': TRAP_SAFE, 'cycle-trap-active': CYCLE_ACTIVE, 'cycle-trap-safe': CYCLE_SAFE,
  'lever-off': LEVER_OFF, 'lever-on': LEVER_ON, 'plate-off': PLATE_OFF, 'plate-on': PLATE_ON,
  crate: CRATE, 'crate-broken': CRATE_BROKEN, 'push-block': PUSH_BLOCK, 'moving-platform': PLATFORM,
  'quest-token': COIN, 'rune-core': recolor(COIN, { Y: 'U', s: 'Q', O: 'u' }), exit: EXIT, stairs: STAIRS,
  'door-closed': DOOR_CLOSED, 'door-open': DOOR_OPEN, 'rune-gate-closed': GATE_CLOSED, 'rune-gate-open': GATE_OPEN,
  torch: TORCH, 'torch-1': TORCH_1, banner: BANNER, rubble: RUBBLE, skull: SKULL
});
